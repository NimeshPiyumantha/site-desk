# SiteDesk — campaign website operations without developers

SiteDesk lets a non-technical marketing / operations team **launch, adapt, translate, bulk-update, publish, investigate and recover** client campaign websites on their own.

It is a working demonstration of the journey asked for in the assignment:

**New campaign → adapt an existing website → add languages → update selected websites together → publish → investigate and recover from a mistake**, plus a **failed launch** and **colleagues making conflicting changes**.

**Where to start:** [§1 Run it](#1-run-it-about-2-minutes) (two commands, demo accounts, example
content) → [§3 Demonstration script](#3-demonstration-script-follow-without-a-walkthrough) (click-by-click,
no walkthrough needed). [§2](#2-the-assignment-point-by-point--where-to-see-each-item) maps every
requirement in the brief to the screen, the demo step and the code. The honest account of
boundaries is [§5](#5-what-works-what-is-simulated-what-is-incomplete); testing is
[§6](#6-how-it-was-checked); where to make a change is [§9](#9-code-map-where-to-change-things).

---

## 1. Run it (about 2 minutes)

Requirements: **Node.js 20.9 or newer** (tested on Node 22 and Node 24). No database server, no cloud account, no API keys, nothing to configure — the whole app, its database and the example websites run on one machine, offline.

```bash
npm install
npm run build
npm start            # → http://localhost:3000
```

For development with hot reload use `npm run dev` instead of build/start.

> Use one mode at a time: `npm run dev` and `npm run build` share the `.next` folder (see *If
> something does not start*, below).

The database (SQLite, one file in `./data`) is **created and filled with demo data automatically on first start**. To start again from clean demo data at any time:

```bash
npm run reset-demo   # stop the app first
```

### Also available

```bash
npm test             # 25 unit tests on the business rules (fast, no browser)
npm run test:e2e     # 13 end-to-end tests in a real browser (first run: npx playwright install chromium)
npm run typecheck    # strict TypeScript
```

### What is in this folder

| | |
|---|---|
| `src/` | all the source code — see the code map in §9 |
| `demo-files/` | the client translation files used in the demo (`demo-files/README.md` says what each one shows) |
| `tests/` | unit tests (`tests/unit`) and the end-to-end journey (`tests/e2e`) |
| `scripts/` | `reset-demo.ts` (fresh demo data), `make-images.ts` (the demo pictures) |
| `data/` | created on first start: the SQLite database and uploaded pictures. Safe to delete — it is rebuilt with demo data |
| `public/demo/` | the demo pictures (local SVG illustrations, so nothing is fetched from the internet) |

`node_modules/` and `.next/` are build output; if they came with the ZIP you can delete them and
run `npm install && npm run build` to be sure of a clean start.

### If something does not start

| Symptom | Reason and fix |
|---|---|
| `Cannot find module './vendor-chunks/…'` | `npm run dev` and `npm run build` share `.next`. Delete `.next`, then `npm run build && npm start`. |
| Port 3000 (or 3100 for the end-to-end tests) already in use | Stop the other process, or run `npx next start -p 3001`. The tests always use 3100. |
| `better-sqlite3` fails to install | It is a native module and needs **Node 20.9+** — check `node -v`. On Windows and macOS it downloads a prebuilt binary, so no compiler is needed. |
| `Executable doesn't exist at …chrome-headless-shell` from `npm run test:e2e` | Playwright uses its own browser build: run `npx playwright install chromium` (again after any Playwright upgrade), or point `PW_CHROMIUM` at an existing Chromium binary. |
| The demo data looks edited from an earlier session | `npm run reset-demo` with the app stopped puts everything back. |

### Sign in

The login page has one-click buttons for each demo person. All passwords are **`demo1234`**.

| Person | Email | Role | Can see |
|---|---|---|---|
| **Amara Perera** | amara@sitedesk.demo | Operations admin | Everything, both workspaces, transfers |
| **Nuwan Silva** | nuwan@sitedesk.demo | Content editor | Summer Escape Travel, Ceylon Tea Trails — can edit, **cannot publish** |
| **Priya Raj** | priya@sitedesk.demo | Reviewer / publisher | Summer Escape Travel, Ceylon Tea Trails — reviews, publishes, restores |
| **Dilan Fernando** | dilan@sitedesk.demo | Content editor | **Only** Arugam Bay Surf Camp |

### Example content

* **Workspace “Colombo Studio”** with 3 clients and 8 live websites:
  * *Summer Escape Travel* — 6 regional websites (Colombo, Galle, Kandy, Jaffna, Trincomalee, Ella) in English / Tamil / Sinhala. All 6 share the offer **FAM-BEACH** (“Family Beach Package”). Galle has 3 published versions, a backup and a change waiting for review.
  * *Ceylon Tea Trails* — “Hill Country Tea Tours”, English only (the starting point for the new-campaign demo).
  * *Arugam Bay Surf Camp* — only Dilan and admins can see it.
* **Workspace “Partner Agency – Kandy”** — empty, used to demonstrate moving a website between workspaces.
* **`demo-files/`** — translation files “sent by the client” (see `demo-files/README.md` for what each one shows):
  * `tamil-translations.csv` — complete Tamil translation
  * `sinhala-translations-incomplete.csv` — partial Sinhala translation (to show missing texts)
  * `sinhala-translations-rest.csv` — the remaining Sinhala texts, so you can finish a language and make it visible
  * `tamil-corrections-messy.csv` — a client file with the `key` column deleted, one ambiguous row and one unknown row
  * `tamil-corrections.json` — the same kind of correction in JSON

Public websites are at `http://localhost:3000/s/<web-address>`, e.g. <http://localhost:3000/s/summer-escape-galle>.

---

## 2. The assignment, point by point — where to see each item

Every requirement in the brief, the screen that answers it, the step in section 3 that shows it, and
the code that implements it. Nothing in this table is a mock-up: each row is working functionality
(the three simulated boundaries are listed in §5).

| The brief asks for | In the app | Step | Code |
|---|---|---|---|
| **1. Launch a new campaign quickly** — a separate website from an existing one in one or two clicks | *Websites* → **Copy for new campaign** (one dialog: name, web address, client) | A1–A2 | `lib/clone.ts` |
| …adapt branding, images, content, offers, contact details | *Edit content* — every section, including *Brand & look* (business name, two colours, logo) and the picture library / upload | A3 | `components/admin/Editor.tsx`, `lib/content/registry.ts` |
| …check the result before making it public | **Preview draft ▾** in any language, with a “not public yet” bar | A4 | `app/(admin)/preview/…` |
| …launch without affecting the original or carrying over private client information | **Launch website**; the original is untouched; contact details, social links, analytics IDs, enquiries, notes, team, history and backups are never copied | A2, A10 | `lib/clone.ts` (`prepareCopy`), unit-tested |
| **2. Update several websites together** — one offer’s price on 4 of 6 websites, English and Tamil only | *Update several websites* (pick offer → field → websites → languages → values) | C11–C13 | `lib/bulk.ts` |
| …check exactly which websites and content will change, everything else unchanged | the preview lists **8 values on 4 websites** *and* what stays the same (Trincomalee, Ella, Galle’s Sinhala price) | C14 | `lib/bulk.ts`, `lib/content/diff.ts` |
| …the same for shared information such as contact details | the same wizard, step 1 → **Contact details** (email / phone / WhatsApp) instead of an offer | C11, pick *Contact details* | `lib/bulk.ts` |
| **3. Manage different languages** — add Tamil and Sinhala to an English campaign | *Languages* → add a language (starts hidden) | B5 | `lib/i18n/languages.ts` |
| …use the client’s translated content without rebuilding or copying item by item | download the spreadsheet for a language, upload the returned CSV or JSON, apply in one action | B6–B8 | `lib/i18n/import.ts`, `lib/i18n/csv.ts` |
| …each translation on the correct page and in the correct place | rows matched by stable field key, or — if the client deleted the key column — by unique source text; ambiguous and unknown rows are reported, never guessed | B10b | `lib/i18n/import.ts`, `lib/content/paths.ts` |
| …see what is missing, review each language, make it public when ready | “17 texts still missing”, each linking to its field; **Make visible** stays disabled until complete | B8–B9 | `lib/content/validate.ts` |
| …visitors switch languages while unfinished translations stay private | public language switcher; a hidden language returns *Page not found* and is absent from `/sitemap.xml` | B10 | `app/(public)/s/…`, `app/sitemap.ts` |
| …adding another language later is straightforward | the rest of the Sinhala arrives → import → complete → make visible → publish | B10a | same as above |
| **4. Work together without losing control** — access only to the clients and actions you are responsible for | per-client roles (editor / reviewer-publisher) + operations admin; enforced server-side on every action, not just hidden in the UI | G26–G27, G2 | `lib/permissions.ts`, `server/services.ts` |
| …unfinished work stays private | a website has a draft (team only) and published versions (visitors); previews require sign-in and are `noindex` | A4 | `server/repo.ts` |
| …one person’s changes do not silently replace another’s | “… is also editing right now”; on save, different fields merge automatically, the same field asks which version to keep | F24–F25 | `lib/content/merge.ts` |
| …publishing affects only the intended websites and content | publishing is per change and per language, never “everything in the draft” | C15, D18 | `lib/content/diff.ts` |
| **5. Understand and recover from mistakes** — identify the live version, what changed, who changed it | *History*: version 4 marked **LIVE NOW**, “Bulk update: Price of offer FAM-BEACH (English and Tamil) by Amara Perera”, with old → new values | D16 | `lib/content/describe.ts` |
| …return to the correct earlier content, described in plain language | **Go back to this version** → shows what changes back → live as a *new* version; nothing is deleted, and the draft is corrected too | D17–D18 | `server/services.ts` |
| …recover a whole website from a backup, understanding what is restored and replaced | *Backups* → **Restore…** → preview of what will be restored and replaced; a safety backup is taken first | D19 | `components/admin/BackupsPanel.tsx` |
| **6. Everyday operations** — Google Analytics and Tag Manager by entering IDs | *Settings* → validated `G-…` / `GTM-…` fields with “where to find this”; added to public pages on the next publish | H | `lib/content/validate.ts`, `app/(public)/s/[slug]/[locale]/layout.tsx` |
| …know which website failed, what happened and what to do next | the publish screen explains what happened, what visitors currently see and what to do; the dashboard and *Activity* name the website; **Try again** | E20–E23 | `server/services.ts`, `lib/help.ts` |
| …keep the existing live website working when a launch fails | the published version is never replaced unless the whole launch succeeds | E22 | `server/services.ts` |
| …keep backups and transfer websites between workspaces without rebuilding or exposing sensitive information | automatic + manual backups; **Download website package** → *Transfer* → upload (arrives as a draft; private data only if ticked) | H | `lib/clone.ts` |
| …find help relevant to the website and task at hand | **? Help** on every screen, with the article for that screen | every step | `lib/help.ts` |
| Client websites and information stay separate | every query is scoped by workspace and client; a URL for another client’s website returns *not found* | G26 | `server/services.ts` |
| Public pages stay accessible to visitors and discoverable by search engines | server-rendered pages, `<html lang>`, per-language title/description, canonical + `hreflang`, `/sitemap.xml`, `/robots.txt` | H | `app/(public)/…`, `app/sitemap.ts`, `app/robots.ts` |

**The connected journey the brief asks to see** — new campaign → adapt → add languages → update
several websites together → publish → investigate and recover — is section 3 **A → B → C → D**, in
that order, on the same example data. The **failed launch** is **E** and **colleagues making
conflicting changes** is **F**. All of them are also covered by the end-to-end tests (§6).

**The short explanation the brief asks for:** assumptions and key decisions → **§4**; what works,
what is simulated, what is incomplete → **§5**; how the journeys and failure cases were checked →
**§6**; what is needed before the business can rely on it daily → **§7**; how it supports more
clients, websites, languages and people → **§8**; and for the *small change during the review*,
where things live and a worked example of exactly that size → **§9**.

---

## 3. Demonstration script (follow without a walkthrough)

Each step lists where to click. The **? Help** button (top right) always shows help for the screen you are on.

**A. Launch a new campaign from an existing website** — *as Amara*
1. *Websites* → on **Hill Country Tea Tours** press **Copy for new campaign**.
2. Name: `Misty Mountain Retreats` (the web address fills in). Client: **+ New client…** → `Misty Mountain Hotels`. Press **Create copy**. *(The dialog lists what is never copied.)*
3. A **checklist** appears. Open **Edit content** → *Contact details*: email and phone are **empty** (private to the original client). Fill them in, change the *Top banner* headline, pick another picture from the library, **Save draft**.
4. **Preview draft ▾** → English. The yellow bar shows it is not public.

**B. Add languages from the client’s translations**
5. *Languages* → add **Tamil**, then **Sinhala** (they start hidden).
6. *(Optional: “Spreadsheet for Tamil” downloads the file you would send to the client.)*
7. Upload `demo-files/tamil-translations.csv` → the preview says where every text goes and “Tamil after import: complete ✓” → **Use these translations**.
8. Upload `demo-files/sinhala-translations-incomplete.csv` → “17 texts still missing” → **Use these translations**. Expand “17 texts missing” — each one links to its exact field.
9. Tamil → **Make visible**. Sinhala’s button is **disabled** until it is complete.
10. **Review & publish** → **Launch website**. Open the live site: English and Tamil are in the language switcher; `/s/misty-mountain-retreats/si` returns *Page not found*. The original Hill Country website is unchanged.
10a. *(A week later the client sends the rest of the Sinhala.)* *Languages* → upload `demo-files/sinhala-translations-rest.csv` → “17 texts will be added or updated” → **Sinhala after import: complete ✓**. **Make visible** is now available → press it → **Review & publish** → publish. `/s/misty-mountain-retreats/si` is now live and appears in `/sitemap.xml`. *This is the whole language lifecycle: hidden → incomplete → complete → public.*
10b. *(Optional — a file with problems.)* Upload `demo-files/tamil-corrections-messy.csv`: the client deleted the `key` column, so rows are matched by their English wording instead. Two rows are reported as not placeable and ignored — “Plan my trip” appears in **2 places**, and “Sunset Cruise Special” does not exist here. The good rows still import. `tamil-corrections.json` shows the same correction in JSON.

**C. Update several websites together**
11. *Update several websites* → Offer **Family Beach Package (FAM-BEACH)** → Price.
12. Tick **Colombo, Galle, Kandy, Jaffna**; languages **English** and **Tamil**.
13. New price: `LKR 39,900 per family` / `ஒரு குடும்பத்திற்கு ரூ. 39,900`.
14. The preview lists exactly **8 values on 4 websites**, and everything that stays the same (Trincomalee and Ella not selected, Galle’s Sinhala price unchanged).
15. Choose **Publish these changes now** → only these prices go live. Galle’s unrelated pending change (Couples’ Hideaway text, waiting for review) stays in draft.

**D. Investigate and recover from a mistake** — *sign out, sign in as Priya*
16. Suppose the new price should only have gone to Colombo. Open **Summer Escape – Galle** → *History*. Version 4 is **LIVE NOW**: “Bulk update: Price of offer FAM-BEACH (English and Tamil) by Amara Perera”; *What changed* shows old → new.
17. On version 3 press **Go back to this version** → the dialog shows exactly what changes back → add a reason → confirm. It is live immediately as version 5. Nothing is deleted.
18. *Review & publish* shows the price is also corrected in the draft (it will not be re-published by accident), while Nuwan’s pending change is kept.
19. *Backups* → **Restore…** on “Before the main summer campaign” shows what will be restored and what replaced, before you confirm. A safety backup is taken first.

**E. A failed launch**
20. Open **Summer Escape – Kandy** → *Settings* → tick **Demo: Make the next launch fail**.
21. *Edit content* → change the headline → Save → *Review & publish* → **Publish**.
22. You see **what happened, what visitors see (the previous version – still working) and what to do**. The dashboard and *Activity* page show which website failed. The live site is unchanged.
23. *Overview* → **Try again** → it goes live.

**F. Two colleagues editing at once**
24. Open the same website’s editor in two browsers (e.g. a normal and a private window) as **Nuwan** and **Priya**. Each sees “… is also editing this website right now”.
25. Both change the same price; Nuwan saves first. When Priya saves: changes to *different* fields are combined automatically; for the *same* field she is asked **which version to keep**. Nothing is overwritten silently.

**G. Access control**
26. Sign in as **Dilan**: only the surf camp is visible; opening another client’s URL gives *not found*.
27. Sign in as **Nuwan**: he can edit and **Send for review**, but there is no Publish button.

**G2. Add a colleague and decide what they can reach** — *as Amara*
28. *People* (top menu) → **Add a person**: `Tharindu Jayasuriya`, `tharindu@sitedesk.demo`, password `demo1234`.
29. Sign in as Tharindu in a private window: *“You don’t have access to any clients in this workspace yet.”* — he can see nothing at all.
30. Back as Amara, on his row set **Summer Escape Travel → Content editor**. Tharindu reloads: the six Summer Escape websites appear, Ceylon Tea Trails does not, and *Review & publish* says *“Only reviewers can publish.”*
31. Set it back to **No access** → the websites disappear again. Try to untick Amara’s own **Operations admin**: it is refused, because she is the last admin.
32. *Activity* records every access change, with who granted it.

**G3. Find text across every website**
33. *Find text* → search `FAM-BEACH` → the six websites running that offer, each result linking straight to the field. Search a phone number or an old price the same way.

**H. Everyday operations**
* *Settings* → Google Analytics / Tag Manager IDs (validated, with “where to find this”). They go live with the next publish and are added to the public pages.
* *Settings* → **Download website package** → switch workspace (top right) → *Transfer* → upload. The website arrives with all pages and languages, as a draft. Enquiries, team, notes — and contact details / analytics IDs unless ticked — are not included.
* *Activity* → **Download as spreadsheet** keeps a copy of who did what, outside the app.
* *Edit content* → **Footer**: the client’s Instagram / Facebook / YouTube links. An icon appears in the footer only when a link is filled in (Hill Country has no YouTube, so it shows two icons, not three). They are marked *private to client* and are cleared when the website is copied for a new campaign.
* Public pages are server-rendered with `<html lang>`, title/description per language, canonical + `hreflang` alternates, `/sitemap.xml` (visible languages only) and `/robots.txt`. Drafts and previews are `noindex` and require sign-in.

---

## 4. Assumptions and key decisions

| Topic | Assumption / decision | Why |
|---|---|---|
| Website structure | All client websites use **one shared template** (as in the screenshot: hero, offer strip, getaway cards, offers, call-to-action, contact + an About page). Content is structured data, not free-form page building. | “Many have a similar structure.” Structured content is what makes bulk updates, translation import and plain-language history possible and safe. |
| Same offer on several websites | Identified by a shared **offer code** (e.g. `FAM-BEACH`). | Names differ by language and can be edited; a code is stable and easy to understand. |
| Prices | Stored as display text **per language** (e.g. “LKR 45,000 per family” / “ரூ. 45,000”). | The brief changes price “only in English and Tamil”, so price is language-specific. |
| Draft vs live | Every website has a **draft** (what the team edits) and **published versions** (what visitors see). Nothing reaches visitors without publishing. | “Check the result before making it public”, “unfinished work stays private”. |
| Publishing scope | A publish applies a **chosen subset of changes** (by change, by language) — not “everything in the draft”. | “Publishing affects only the intended websites and content.” Bulk publishing uses the same mechanism. |
| Field addresses | Every value has a readable address (`offers.items.@fam-beach.price.ta`); list items are addressed by **id**, never by position. | Makes concurrent edits, diffs and translation import exact. |
| Concurrent edits | **Optimistic concurrency with field-level 3-way merge**: a save carries the revision it started from; different fields merge, the same field asks a person. | Real collaboration without locking people out; never silently overwrites. |
| Roles | Per client: **editor** (prepare, request review) and **publisher** (publish, restore, settings); global **admin**. Enforced on the server for every action. | “Access only to the clients and actions they are responsible for.” |
| Private client information | Contact details, social media links, analytics IDs, enquiries, internal notes, team access, history and backups. Never copied to a new campaign; not in transfer packages unless chosen. | “Without carrying over private client information.” |
| Recovering | Going back creates a **new version** (history is append-only) and also reverts the same fields in the draft. | Easy to undo the undo; prevents re-publishing the mistake. |
| Hosting | The public site is served by the same app at `/s/<address>`. “Deployment” is a simulated step. | Keeps the demo self-contained; see §5. |
| Translations | CSV (opens in Excel / Google Sheets) generated from the site, or JSON. Rows matched by key; without a key, by unique main-language text. Main language is never overwritten by an import. | Clients work in spreadsheets; matching by key guarantees “correct page and correct place”. |
| Pictures | Demo pictures are local SVG illustrations (works offline). Uploads (JPG/PNG/WebP/GIF/SVG, ≤6 MB) are stored in `data/uploads`. | No external dependencies for the reviewer. |

## 5. What works, what is simulated, what is incomplete

**Works end-to-end (real code, real database):** copying websites with private data removed and a setup checklist; structured editor for all sections including lists (add / remove / reorder), image upload and picture library; per-language editing with main-language reference; draft preview in any language with missing translations highlighted; adding languages; translation spreadsheet download, upload, matching report and apply; language visibility rules; field-level selective publishing with plain-language before/after; launch checks with “what to do” messages; editor → reviewer workflow; bulk update preview + save-to-draft or publish-only-those-values; version history with authors and plain-language summaries; go back to any version; automatic and manual backups with restore preview and safety backup; analytics IDs (validated, injected into public pages); activity log; presence (“also editing”) and conflict resolution; role-based access on every server action; workspace switching; export/import packages; public pages with SEO metadata, hreflang, sitemap and robots; public enquiry form (stored privately per client); contextual help; **people & access management** (add a colleague, give or take away a role per client, admin rights with a last-admin safeguard); **find text across every website and language**; **activity log export to a spreadsheet**.

**Simulated:**
* **Hosting / deployment.** The public site is served from the same app. The “upload to web host” step is simulated; a failure can be forced from *Settings → Demo*. A missing uploaded picture also fails the launch for real.
* **Sign-in.** Email + password demo accounts with a signed session cookie. No password reset, SSO or 2FA.
* **Custom domains.** Websites live under `/s/<address>`; real domains (e.g. `summerescape.lk`) are not mapped.

**Not built (would be next).** These all need something outside the app – an external service, credentials or a background worker – so they are deliberately left out rather than faked:

| Not built | Why it is not in the demo |
|---|---|
| Notifications by email / Slack | Needs an SMTP account or Slack webhook. Review requests and failed launches appear on the dashboard and in Activity instead. |
| Scheduled publishing (“go live Monday 9am”) | Needs a background scheduler/worker; a request-triggered fake would be misleading about reliability. |
| Image resizing / CDN delivery | Needs a native image library and object storage. Uploads are stored and served as-is. |
| More than one website template | A second template means a second content registry; the architecture allows it (see §8) but it is a large piece of work, not a demo detail. |
| Translation memory / machine-translation suggestions | Needs a paid translation API key. |
| Per-field comments | Reviewers leave one note per review request today; per-field threads are a genuine next step. |
| Real hosting, SSO/2FA, custom domains | See **Simulated** above. |

## 6. How it was checked

Last full run before submission: **11 October 2026**, Windows 11 / Node 24.16 — `npm run build`,
`npm run typecheck`, **25/25** unit tests and **13/13** end-to-end tests against a fresh production
build and freshly seeded data, all green (the end-to-end suite takes about 20 seconds).

* **Unit tests** (`npm test`, 25 tests, Vitest) on the core rules: field paths, diffs, publishing only selected changes (and that publishing everything equals the draft), merging edits / detecting conflicts, the 4-of-6 websites × English+Tamil bulk scenario (exactly 8 changes; Sinhala and unselected websites untouched), translation import (round-trip, partial, matching by text, unknown keys, CSV quoting), private data removed on copy and export, launch checks, permissions (including that only operations admins can manage people and access), and that footer social links are cleared on a copy and stay out of translation files.
* **End-to-end tests** (`npm run test:e2e`, 13 tests, Playwright, real browser against a production build with fresh demo data) covering the whole connected journey (sections A–H of §3), including the failed launch, the conflict between two signed-in colleagues, access restrictions, backup restore, workspace transfer, adding a colleague and granting/removing their access (including that the last admin cannot be removed), cross-website search, the activity export, finishing a part-translated language and making it public, and a client file with a deleted key column (ambiguous and unknown rows reported, good rows still imported). They also check the **public** HTML: `lang` attribute, sitemap contents, private languages returning 404, and that no data from the original client leaks into the copy.
  * First run: `npx playwright install chromium` (or set `PW_CHROMIUM` to an existing Chromium path).
* `npm run typecheck` — strict TypeScript, no errors.
* Manual review of every screen at desktop (1440px) and phone (390px) width, including that the
  navigation stays reachable while scrolling on a phone and that every navigation link exists
  **once** in the page (a hidden mobile duplicate would confuse screen readers as well as tests).

Bugs found by these tests and fixed: a duplicate database connection caused by Next.js loading the module twice (new writes briefly invisible to page rendering); confirmation messages disappearing when the page refreshed after restore/retry.

## 7. Before the business relies on it every day

1. **Real hosting pipeline:** render published versions to static files and upload to a CDN/object storage (e.g. Cloudflare/S3) per website; health-check after upload and automatic rollback; real custom domains + HTTPS.
2. **Database:** move from SQLite to PostgreSQL (the data layer is isolated in `src/server/repo.ts`); scheduled off-site backups; migrations tool.
3. **Accounts & security:** SSO / Google Workspace login, 2FA, user and role management screens, rate limiting, CSRF review, content-security policy, malware scanning and resizing of uploads.
4. **Notifications:** email / Slack when a review is requested, a launch fails, or a publish happens.
5. **Monitoring:** error tracking (e.g. Sentry), uptime checks of every public website, alerting.
6. **Usability testing** with two or three real team members, then accessibility audit (WCAG AA).
7. **Legal:** cookie consent before loading Google Analytics/Tag Manager (required in many markets), privacy notice for the enquiry form, data retention for enquiries.

## 8. How it scales

* **More clients / websites:** websites are rows, not code — copying one is a database operation. Bulk updates work across any number of websites the person can access. Permission checks are per client. Workspaces separate teams or agencies. With PostgreSQL and static publishing, serving thousands of sites is a CDN concern, not an app concern.
* **More languages:** adding a language is a click; the catalog in `src/lib/i18n/languages.ts` lists the offered languages (RTL supported). Every text field is translatable by default because the template is described in one registry.
* **More team members:** field-level merging means people rarely block each other; roles are per client; every action is in the audit log.
* **More kinds of content:** the template is described once in `src/lib/content/registry.ts`. The editor, translation files, history labels, publish checks and bulk updates all read from it, so adding a field or section updates every screen at once. Supporting several templates would mean one registry per template.

---

## 9. Code map (where to change things)

```
src/lib/                    Pure business rules – no database, fully unit-tested
  content/types.ts          Shape of a website's content (SiteContent) and edit operations
  content/registry.ts       ★ Every editable field: label, page, section, translated?, required?, private?
  content/paths.ts          Field addresses, flatten / get / set
  content/describe.ts       Paths → plain language ("Offers › Family Beach Package › Price (Tamil)")
  content/diff.ts           Compare versions, group changes, publish only selected changes
  content/merge.ts          Combine concurrent edits, detect conflicts
  content/validate.ts       Translation progress and launch checks (+ GA/GTM ID validation)
  i18n/                     Languages catalog, CSV reader/writer, translation import/export
  bulk.ts                   Bulk-update planning (what changes, what stays)
  clone.ts                  Copy for a new campaign (private data removed), transfer packages
  permissions.ts            Roles → allowed actions (add an Action here, then check it in services.ts)
  help.ts                   Help articles per screen
src/server/                 Server-only code
  db.ts                     SQLite connection + schema (auto-created and seeded)
  repo.ts                   Database reads/writes (the only place with SQL)
  services.ts               Business operations: permission check → transaction → audit
  actions.ts                Server actions called by the screens
  auth.ts                   Sessions, current user, workspace
  seed.ts, seed-content.ts  Demo data (EN / TA / SI)
tailwind.config.ts          ★ Design tokens: colours (brand, surface, live/draft/stop), shadows, radii
src/app/globals.css         ★ The component classes every screen uses: .btn-*, .card, .input,
                              .pill-live / .pill-draft / .pill-stop, .nav-link, .page-title
src/components/public/      The website template (used for live pages AND preview). Styles itself
                              from each client's own brand colours (--brand / --accent) plus a small
                              neutral palette — deliberately NOT the team app's colours.
src/components/admin/       Team screens (editor, publish, bulk wizard, languages, history, people & access, …)
src/app/(admin)/            Team app routes (/login, /app/…, /app/team, /app/search, /preview/…)
src/app/(public)/s/…        Public websites (own root layout → correct <html lang>)
tests/unit, tests/e2e       Vitest and Playwright tests
```

**Two separate looks, on purpose.** The *client websites* take their colours from each website's
own brand settings, so two campaigns never look alike; the template only supplies layout, type and
spacing. The *team app* has its own fixed palette. Changing one never changes the other.

**Changing how it looks.** Colours, shadows and corner radii live in `tailwind.config.ts`; the
component classes every screen shares (`.btn-primary`, `.card`, `.input`, `.pill-live`, `.nav-link`,
`.page-title`) live in `src/app/globals.css`. Restyling the whole tool is a change to those two
files — screens almost never carry colours of their own. Status colour is used consistently
everywhere: **green = live**, **amber = waiting / draft**, **red = failed or blocked**.

**Example small changes**
* *Rename or relabel a field / change its input control:* `src/lib/content/registry.ts` (label, `type: "text" | "longtext" | "price" | …`), rendering of each type in `Field()` in `src/components/admin/Editor.tsx`.
* *Add a field:* add it to `types.ts`, `registry.ts`, the template in `SiteRenderer.tsx`, and seed data. Translation files, history, checks and preview pick it up automatically.

**Worked example — the footer social links** (a change of exactly the size the brief’s “A small change during the review” describes). Five files, and TypeScript names every place that still needs attention:

| File | Change |
|---|---|
| `src/lib/content/types.ts` | `footer` gains `instagram`, `facebook`, `youtube` (plain strings) |
| `src/lib/content/registry.ts` | three fields with a new `url` type, `private: true` |
| `src/components/admin/Editor.tsx` | one line so `url` renders an `<input type="url">` |
| `src/components/public/SiteRenderer.tsx` | `<SocialLinks>` — inline SVG, an icon only when the link is filled in |
| `src/server/seed-content.ts` | demo values (the compiler pointed at both sites) |

Two consequences worth noticing before making a change like this:
* **Localized or not?** Links are the same in every language, so they are **not** `localized`. Had they been, every translation spreadsheet would have grown by three rows and the “Tamil: complete ✓” demo would have broken. `listTextFields()` only collects `localized` fields — that is the line that decides it.
* **Private or not?** Social accounts belong to the client, so `private: true` and a line in `prepareCopy()` clears them, exactly like contact details. A unit test now pins both behaviours.
* *Rename a database column:* the SQL lives only in `src/server/db.ts` (schema) and `src/server/repo.ts` (queries + row types); TypeScript then points to every usage. Existing databases need an `ALTER TABLE … RENAME COLUMN` (or `npm run reset-demo` for the demo).

## 10. Use of AI

Built with AI assistance (Claude) for code generation, review and test writing. Decisions, assumptions and verification are described above; the working records can be shared on request.
