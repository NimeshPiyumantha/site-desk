"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { DisplayChange } from "@/lib/content/diff";
import type { Issue } from "@/lib/content/validate";
import { languageName } from "@/lib/i18n/languages";
import { publishAction, requestReviewAction } from "@/server/actions";
import { Notice } from "./ui";

type Result =
  | { tone: "success"; text: string }
  | { tone: "blocked"; issues: Issue[] }
  | { tone: "failed"; whatHappened: string; whatToDo: string }
  | { tone: "error"; text: string };

export default function PublishPanel(props: { siteId: string; changes: DisplayChange[]; firstLaunch: boolean; canPublish: boolean; canRequest: boolean; draftIssues: Issue[]; liveNumber: number | null; reviewState: string; slug: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.changes.map((c) => c.id)));
  const [filter, setFilter] = useState<string>("all");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const changeKey = props.changes.map((c) => c.id).join("|");
  useEffect(() => {
    setSelected(new Set(props.changes.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeKey]);

  const locales = useMemo(() => [...new Set(props.changes.map((c) => c.locale).filter(Boolean) as string[])], [props.changes]);
  const visible = props.changes.filter((c) => filter === "all" || (filter === "shared" ? !c.locale : c.locale === filter));
  const groups = useMemo(() => {
    const m = new Map<string, DisplayChange[]>();
    for (const c of visible) m.set(c.section, [...(m.get(c.section) ?? []), c]);
    return [...m.entries()];
  }, [visible]);

  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const onlyLanguages = (langs: string[]) => setSelected(new Set(props.changes.filter((c) => !c.locale || langs.includes(c.locale)).map((c) => c.id)));

  function publish() {
    setResult(null);
    start(async () => {
      const ids = props.firstLaunch || selected.size === props.changes.length ? "all" : [...selected];
      const res = await publishAction(props.siteId, ids, note);
      if (res.ok) setResult({ tone: "success", text: `Version ${res.releaseNumber} is live. ${res.summary}` });
      else if ("kind" in res && res.kind === "blocked") setResult({ tone: "blocked", issues: res.issues });
      else if ("kind" in res && res.kind === "failed") setResult({ tone: "failed", whatHappened: res.error.whatHappened, whatToDo: res.error.whatToDo });
      else setResult({ tone: "error", text: "message" in res ? res.message : "error" in res ? res.error : "Could not publish." });
    });
  }

  const blockers = props.draftIssues.filter((i) => i.severity === "error");
  const warnings = props.draftIssues.filter((i) => i.severity === "warning");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {result?.tone === "success" && (
          <Notice tone="success" title="Published">
            {result.text} <a className="underline" href={`/s/${props.slug}`} target="_blank">Open the live website ↗</a>
          </Notice>
        )}
        {result?.tone === "blocked" && (
          <Notice tone="error" title="Not published – please fix these first">
            <ul className="list-disc space-y-1 pl-5">{result.issues.map((i, n) => <li key={n}>{i.message} <em>{i.fix}</em></li>)}</ul>
            <p className="mt-2">Nothing changed on the live website.</p>
          </Notice>
        )}
        {result?.tone === "failed" && (
          <Notice tone="error" title="The launch failed">
            <p><strong>What happened:</strong> {result.whatHappened}</p>
            <p><strong>Visitors see:</strong> {props.liveNumber ? `version ${props.liveNumber}, as before – the website is working.` : "nothing yet – it was not live before."}</p>
            <p><strong>What to do:</strong> {result.whatToDo}</p>
            <Link href={`/app/sites/${props.siteId}`} className="underline">Go to the overview to try again</Link>
          </Notice>
        )}
        {result?.tone === "error" && <Notice tone="error">{result.text}</Notice>}

        {props.firstLaunch ? (
          <section className="card p-5">
            <h2 className="font-semibold">First launch</h2>
            <p className="mt-1 text-sm text-ink-soft">This website has never been public. Launching makes the whole draft live in the languages marked visible.</p>
          </section>
        ) : props.changes.length === 0 ? (
          <section className="card p-6 text-sm text-ink-soft">Everything in the draft is already live. Edit the content to prepare the next update.</section>
        ) : (
          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Changes waiting to go live</h2>
              <span className="text-sm text-ink-soft">{selected.size} of {props.changes.length} selected</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="text-ink-soft">Show:</span>
              {["all", ...locales, "shared"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`pill border px-3 py-1 ${filter === f ? "border-brand bg-brand-light text-brand" : "bg-white"}`}>
                  {f === "all" ? "Everything" : f === "shared" ? "Same in all languages" : languageName(f)}
                </button>
              ))}
            </div>
            {props.canPublish && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <button className="text-brand underline" onClick={() => setSelected(new Set(props.changes.map((c) => c.id)))}>Select all</button>
                <button className="text-brand underline" onClick={() => setSelected(new Set())}>Select none</button>
                {locales.map((l) => <button key={l} className="text-brand underline" onClick={() => onlyLanguages([l])}>Only {languageName(l)} + shared</button>)}
              </div>
            )}
            <div className="mt-4 space-y-4">
              {groups.map(([section, items]) => (
                <div key={section}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{section}</h3>
                  <ul className="mt-1 divide-y rounded-lg border">
                    {items.map((c) => (
                      <li key={c.id} className="flex gap-3 p-3 text-sm">
                        {props.canPublish && <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={selected.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} aria-label={`Publish: ${c.label}`} />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{c.label} {c.locale ? <span className="pill bg-gray-100 text-ink-soft">{languageName(c.locale)}</span> : <span className="pill bg-gray-100 text-ink-faint">all languages</span>}</p>
                          {c.kind === "field" ? (
                            <div className="mt-1 grid gap-1 sm:grid-cols-2">
                              <p className="rounded bg-red-50 px-2 py-1 text-red-900"><span className="text-xs uppercase">Live now:</span> {c.before}</p>
                              <p className="rounded bg-emerald-50 px-2 py-1 text-emerald-900"><span className="text-xs uppercase">After publishing:</span> {c.after}</p>
                            </div>
                          ) : (
                            <p className="mt-1 text-ink-soft">{c.detail}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <section className="card p-5">
          <h2 className="font-semibold">Checks</h2>
          {blockers.length === 0 ? <p className="mt-2 text-sm text-emerald-700">✓ The draft passes all launch checks.</p> : (
            <ul className="mt-2 space-y-2 text-sm text-red-800">{blockers.map((i, n) => <li key={n}>✕ {i.message}<br /><span className="text-xs text-ink-soft">{i.fix}</span></li>)}</ul>
          )}
          {warnings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-ink-soft">{warnings.map((i, n) => <li key={n}>ⓘ {i.message}</li>)}</ul>}
          {blockers.length > 0 && !props.firstLaunch && <p className="mt-2 text-xs text-ink-soft">You can still publish a selection that does not include these problems – the checks run again on exactly what you publish.</p>}
        </section>
        {props.canPublish ? (
          <section className="card space-y-3 p-5">
            <label className="label" htmlFor="pub-note">Note for the history (optional)</label>
            <input id="pub-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Price change approved by client" />
            <button className="btn-primary w-full" disabled={pending || (!props.firstLaunch && selected.size === 0)} onClick={publish}>
              {pending ? "Checking and publishing…" : props.firstLaunch ? "Launch website" : `Publish ${selected.size} change${selected.size === 1 ? "" : "s"}`}
            </button>
            <p className="hint">A backup is taken automatically. If anything fails, visitors keep seeing the current version.</p>
          </section>
        ) : (
          <section className="card space-y-3 p-5 text-sm">
            <p>Only reviewers can publish. {props.reviewState === "ready" ? "These changes are already waiting for review." : "Send them for review when you are ready."}</p>
            {props.reviewState !== "ready" && props.canRequest && (props.changes.length > 0 || props.firstLaunch) && (
              <>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message for the reviewer (optional)" aria-label="Message for the reviewer" />
                <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => { await requestReviewAction(props.siteId, note); setResult({ tone: "success", text: "Sent for review. The reviewer will see it on their dashboard." }); })}>Send for review</button>
              </>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
