# How this was built, decided and checked

A record of the engineering decisions behind SiteDesk, the bugs found along the way, and how each
fix was verified. The assignment asks for workflow records alongside the solution; this is that,
written to be read on its own.

The product itself is described in [README.md](README.md): §4 holds the assumptions, §5 what is
simulated or incomplete, §6 how it was checked, §7 what daily reliance would need, §8 scaling.
This document is about *how the work was done* rather than what it does.

AI assistance was used throughout, as a pair rather than a generator: it drafted and refactored,
and every claim it made was checked against a running system before being accepted. Several of the
entries below exist because that checking caught something the AI had got wrong, including work it
had already reported as finished.

---

## The working rule: a test that cannot fail proves nothing

The most useful habit in this project was refusing to trust a passing test until it had been shown
capable of failing. It caught three false positives that would otherwise have shipped.

| what passed | why it proved nothing | how it was caught |
|---|---|---|
| Sign-in worked on the hosted copy | The check signed in and read one page, which stays on one warm instance. Sessions were broken across instances. | A real user reported being signed out; the rewritten check bounced **39 of 48** requests |
| Concurrent start-up was safe | All six "instances" ran in one process, where `globalThis` made them share a single set-up | A negative control passed identically with the fix removed — so the test was insensitive |
| The database race was fixed | `git stash push` had nothing to stash because the fix was already committed, so the "without fix" run still had it | Removing the lock by hand gave **1 of 6** instances healthy, against **6 of 6** with it |

Every fix below therefore reports a before-and-after number, not just an after.

---

## Decisions, and what each one cost

### SQLite in a file, not a database server

The assignment is evaluated by someone running it once. A file means `npm install && npm start`
with no account, no keys and no network — the two-minute path in §1. The cost is that the app
assumes one writable disk, which is where most of the trouble below came from.

Kept as the default even after Postgres was added, so that path still works offline.

### A driver interface instead of replacing SQLite

Making the hosted copy work needed a shared database, and every hosted client is asynchronous
while `better-sqlite3` is synchronous. Two options: replace SQLite, or support both.

Replacing it would have broken the claim that the project runs with nothing configured — a
reviewer would need a Supabase account before seeing anything. Supporting both keeps that promise:
no `DATABASE_URL`, no setup.

The cost was a real refactor. Measured before starting, so the decision was informed rather than
hopeful:

| | |
|---|---|
| synchronous SQLite call sites | 55 |
| exported functions to become async | 59 |
| server actions to thread `await` through | 31 |
| pages and components calling them | 19 |

Strict TypeScript was the safety net: 289 errors, each a missed `await`. Four would have been
silent at runtime rather than loud, and are the reason the type checker was worth leaning on:

- a non-null assertion landing on the promise instead of the row (`await repo.getSite(id)!`)
- `.map()` called on a promise
- a **spread of an unawaited call** — `...svc.exportPackage(…)` yields no properties at all, so the
  package download would have produced an empty file
- a `forEach` with awaits inside the seed, which would have let the transaction commit before its
  inserts finished

Queries are still written once, in SQLite's style, and the Postgres driver rewrites `?` and
`@name` to `$1 … $n`. One set of SQL cannot drift; two dialects of the same query would.

### Preserving behaviour the refactor could have quietly changed

Two places where the obvious port would have altered semantics:

**Nested transactions.** `updateSettings` calls `saveDraft`, which opens its own transaction.
`better-sqlite3` nests via savepoints, so an inner failure undoes only the inner part. Flattening
them into one transaction would have been simpler and wrong, so both drivers implement savepoints.

**History ordering.** Release and backup history ordered by `created_at DESC, rowid DESC`, and
Postgres has no `rowid`. Rather than give the two dialects different tie-breakers, `now()` is now
strictly increasing, so `created_at` orders reliably on its own. This matters in practice: the
end-to-end publishes land inside the same millisecond.

### Uploaded pictures in the database, not on disk

Pictures were written to the data directory. On a host that gives each instance its own temporary
disk, the file lands on one instance and every other one serves a placeholder — the picture appears
to upload and then will not load.

They now live in an `uploads` table beside the content that refers to them (`BLOB` on SQLite,
`BYTEA` on Postgres). Object storage would be the answer at scale, but it adds an account and a
second failure mode for a demo, and the database was already shared.

Two things followed for free. Transfer packages now carry the bytes, so a transferred website keeps
its pictures — a defect that existed locally too, independent of hosting. And the launch check can
ask "are the pictures there?" again on every host; that step had been skipped on serverless because
a missing file meant nothing there. Verified both directions: a launch accepts a picture held only
in the database, and still fails for one that is genuinely absent.

---

## Bugs found, and the evidence for each

These were found by running the thing, not by reading it. Four of the five were self-inflicted —
caused by an earlier fix in this same session — which is the honest shape of the work.

### 1. Every page returned 500 on the hosted copy

`db.ts` created its data directory at import time. The project directory is read-only on a
serverless host, so the module threw before handling any request — 8 ms, no outgoing calls.

Fixed by falling back to `/tmp`. **This fix caused bugs 2 and 3.**

### 2. Signing in worked, then did not stick

*Introduced by the fix above.* Sessions are signed with a secret written into the data directory.
That was fine while the directory was shared; per-instance disks meant every instance invented a
different secret and rejected the others' sessions.

```
before:  authenticated=9   bounced to login=39   of 48
after:   authenticated=48  bounced to login=0    of 48
```

The secret is now fixed at build time on such a host, so every instance of a deployment agrees;
`SITEDESK_SECRET` overrides it and makes sessions survive a redeploy. Verified by minting a cookie,
rebuilding from scratch, and checking the old cookie still authenticated 10/10.

Worth naming plainly: this was reported as working twice before a user said otherwise. The check
signed in and read one page — a path that stays on one warm instance and passes every time. It was
testing a single request, not session continuity, which was the only thing that mattered.

### 3. Saved edits appeared on about one page load in six

*Also a consequence of bug 1.* The database was a file on a per-instance disk, so an edit was only
visible to the instance that stored it.

```
Vercel on per-instance SQLite:  edit visible on 1 of 6 reloads
Vercel on shared Postgres:      edit visible on 8 of 8 reloads
```

This is the one that justified the driver work. A container host with a volume was offered as the
cheaper alternative — zero code changes, verified 17/17 — and `Dockerfile` and `fly.toml` are in the
repo for it. Postgres was chosen to keep the existing hosting.

### 4. 500s again, intermittently, right after pointing at an empty Postgres

A diagnostic route proved the connection itself was fine (`dialect: postgres`, `userCount: 4`), so
it was not connectivity. Several instances cold-start together and all ran the set-up: concurrent
`CREATE TABLE IF NOT EXISTS` is **not** race-safe in Postgres — the losers fail on the catalogue
index `pg_type_typname_nsp_index`.

Behind it sat a worse one: `db()` cached the set-up *promise* and kept it even when it rejected, so
an instance that lost the race answered every later request with the same error for the rest of its
life. That is why the failures looked random and then cleared up.

```
six separate processes, empty database
before:  1 of 6 instances healthy
after:   6 of 6 healthy, seeded exactly once
```

Schema and seed now run under `pg_advisory_xact_lock`; a failed set-up clears the cache so the next
request starts over.

### 5. Uploaded pictures would not load

Described under the decision above. Verified by uploading through the editor in a real browser on
all three environments, each returning `image/png` on every request, with a never-uploaded file
still degrading to the placeholder.

### Not a bug: the preview crash

A reported server error on `/preview/site_surf/en` turned out to be an instance poisoned by bug 4,
already fixed. Confirmed by checking the route on all three environments rather than editing
anything — 200 everywhere, including the Tamil and `/about` variants. Repeated console errors
reported alongside it were a browser extension (`chrome.runtime.sendMessage`), with no matching API
anywhere in `src/`.

---

## How it is verified now

| | SQLite | Supabase Postgres |
|---|---|---|
| 13 end-to-end journeys | 13/13 | 13/13 |
| full journey, 26 checks | — | local **and** hosted, 26/26 each |
| uploads, launch checks, packages | pass | pass |
| transactions, savepoints, publish, conflict, rollback | — | 12/12 |
| cold start, six processes | — | 6/6 |
| 25 unit tests · typecheck · build | pass · 0 errors · 0 errors | — |

The end-to-end suite runs against either backend (`npm run test:e2e`, `npm run test:e2e:pg`). It
empties its database first, because the journeys rewrite the demo data.

Running it against Postgres earned its place immediately by finding two races that instant local
writes had been hiding — **both in the tests, not the app**:

- a four-website bulk publish makes dozens of round trips in sequence and does not finish inside a
  15-second wait; it passes in about 45. Postgres mode allows longer; the local file keeps short
  timeouts so real regressions still surface quickly.
- taking a client away from someone was not waited on before the other person reloaded, and the
  assertion re-queries the page without re-fetching it, so it could never recover. The grant beside
  it already waited for its confirmation; now the removal does too. Checked separately that the
  product was right: six websites visible after granting, none after removing.

One safety decision there: the Postgres mode reads `E2E_DATABASE_URL`, never `DATABASE_URL`. The
suite drops every table, and during this work it was nearly pointed at live demo data purely
because a `.env` existed. Choosing a database to wipe has to be a decision, not a side effect.

---

## What is still true at the end

Honest limits, beyond §5 of the README:

- **The launch step is simulated.** The public site is served by the same app; "upload to web host"
  is a step that can be made to fail on purpose. The assignment permits simulation if identified.
- **Region mismatch.** The database is in `ap-northeast-1` and the deployment serves from `iad1`,
  so every query crosses the Pacific. Chatty operations such as a bulk publish take around 45
  seconds. Moving either one would fix it; neither is a code change.
- **Object storage would be the real answer for pictures** at any real volume. Rows in a database
  are the right trade for a demo, not for production.
- **One writable copy.** With SQLite the app must run as a single instance; the `fly.toml` says so
  in two places, because scaling it out would silently reintroduce bug 3.

## What would come next, in order

1. Move the database to the deployment's region, or the deployment to the database's.
2. Pictures to object storage, with the database holding references.
3. The end-to-end suite in CI against Postgres, so the races above cannot come back.
4. Notifications, scheduled publishing and per-field comments — each needs a service the demo
   deliberately does without, and each is listed in §5 with the reason.
