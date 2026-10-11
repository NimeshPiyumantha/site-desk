"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { SiteContent } from "@/lib/content/types";
import { translationCoverage } from "@/lib/content/validate";
import { buildTemplateCsv, type ImportPlan } from "@/lib/i18n/import";
import { LANGUAGE_CATALOG, languageName } from "@/lib/i18n/languages";
import { addLanguageAction, applyTranslationAction, setLanguageVisibilityAction, translationPreviewAction } from "@/server/actions";
import { Notice } from "./ui";

export default function LanguagesPanel(props: { siteId: string; slug: string; draft: SiteContent; liveLanguages: string[]; canEdit: boolean }) {
  const { draft } = props;
  const main = draft.settings.defaultLanguage;
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [newLang, setNewLang] = useState("");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [fileLocale, setFileLocale] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const available = LANGUAGE_CATALOG.filter((l) => !draft.settings.languages.some((x) => x.id === l.code));
  const others = draft.settings.languages.filter((l) => l.id !== main).map((l) => l.id);

  function download(locales: string[]) {
    const csv = buildTemplateCsv(draft, locales);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${props.slug}-translations-${locales.join("-") || "all"}.csv`;
    a.click();
  }

  function preview(f = file, loc = fileLocale) {
    if (!f) return;
    start(async () => {
      const r = await translationPreviewAction(props.siteId, f.text, f.name, loc || undefined);
      if (r.ok) { setPlan(r.plan); setMsg(null); }
      else { setPlan(null); setMsg({ tone: "error", text: r.error }); }
    });
  }

  return (
    <div className="space-y-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr><th className="p-3">Language</th><th className="p-3">Translated</th><th className="p-3">Visitors can see it?</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {draft.settings.languages.map((l) => {
              const cov = translationCoverage(draft, l.id);
              const isLive = props.liveLanguages.includes(l.id);
              const complete = cov.missing.length === 0;
              return (
                <tr key={l.id} data-testid={`lang-${l.id}`} className="align-top">
                  <td className="p-3"><span className="font-medium">{languageName(l.id)}</span>{l.id === main && <span className="pill ml-2 bg-brand-light text-brand">main language</span>}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded bg-gray-200"><div className={`h-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${cov.percent}%` }} /></div>
                      <span>{cov.percent}%</span>
                    </div>
                    {!complete && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-amber-700">{cov.missing.length} text{cov.missing.length === 1 ? "" : "s"} missing</summary>
                        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs">
                          {cov.missing.map((m) => (
                            <li key={m.key}><Link className="text-brand underline" href={`/app/sites/${props.siteId}/edit?section=${m.key.split(".")[0]}&lang=${l.id}`}>{m.page} › {m.label}</Link></li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="p-3">
                    <p>{isLive ? <span className="text-emerald-700">● Visible now</span> : <span className="text-ink-soft">● Hidden (private)</span>}</p>
                    {l.public !== isLive && <p className="text-xs text-amber-700">{l.public ? "Will become visible when published" : "Will be hidden when published"}</p>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap p-3 text-right">
                    <a className="btn-ghost px-2 py-1" href={`/preview/${props.siteId}/${l.id}`} target="_blank">Preview</a>
                    {l.id !== main && props.canEdit && (
                      l.public ? (
                        <button className="btn-secondary py-1" disabled={pending} onClick={() => start(async () => { await setLanguageVisibilityAction(props.siteId, l.id, false); setMsg({ tone: "info", text: `${languageName(l.id)} will be hidden when you next publish.` }); })}>Hide</button>
                      ) : (
                        <button
                          className="btn-primary py-1"
                          disabled={pending || !complete}
                          title={complete ? "" : "Add the missing texts first"}
                          onClick={() => start(async () => { await setLanguageVisibilityAction(props.siteId, l.id, true); setMsg({ tone: "success", text: `${languageName(l.id)} is ready. Publish to make it visible to visitors.` }); })}
                        >
                          Make visible
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {draft.settings.languages.some((l) => l.public !== props.liveLanguages.includes(l.id)) && (
        <Notice tone="info">Language visibility changes are saved in the draft. <Link href={`/app/sites/${props.siteId}/publish`} className="underline">Review & publish</Link> to apply them.</Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">1. Add a language</h2>
          <p className="text-sm text-ink-soft">New languages start hidden. Nothing changes for visitors until the translation is complete and you publish it.</p>
          <div className="flex gap-2">
            <select className="input" value={newLang} onChange={(e) => setNewLang(e.target.value)} disabled={!props.canEdit} aria-label="Language to add">
              <option value="">Choose a language…</option>
              {available.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.nativeName})</option>)}
            </select>
            <button className="btn-primary" disabled={!newLang || pending || !props.canEdit} onClick={() => start(async () => { const r = await addLanguageAction(props.siteId, newLang); setMsg(r.ok ? { tone: "success", text: `${languageName(newLang)} added (hidden). Now download the translation spreadsheet.` } : { tone: "error", text: ("error" in r && r.error) || "Could not add." }); setNewLang(""); })}>Add</button>
          </div>
          <h2 className="pt-2 font-semibold">2. Get the translations</h2>
          <p className="text-sm text-ink-soft">Download a spreadsheet listing every text with its page and section. The client fills in their language column and sends it back.</p>
          <div className="flex flex-wrap gap-2">
            {others.map((l) => <button key={l} className="btn-secondary" onClick={() => download([l])}>⇩ Spreadsheet for {languageName(l)}</button>)}
            {others.length > 1 && <button className="btn-secondary" onClick={() => download(others)}>⇩ All languages</button>}
            {others.length === 0 && <p className="text-sm text-ink-faint">Add a language first.</p>}
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">3. Upload the completed translations</h2>
          <p className="text-sm text-ink-soft">CSV spreadsheet (from step 2) or JSON. Every text goes to its exact place; you will see the result before anything is changed.</p>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={!props.canEdit}
            aria-label="Translation file"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-brand"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const next = { name: f.name, text: await f.text() };
              setFile(next);
              preview(next);
            }}
          />
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            If the file has a single “text” column, it contains:
            <select className="input w-auto py-1 text-xs" value={fileLocale} onChange={(e) => { setFileLocale(e.target.value); preview(file, e.target.value); }}>
              <option value="">(worked out from the columns)</option>
              {others.map((l) => <option key={l} value={l}>{languageName(l)}</option>)}
            </select>
          </label>
          {pending && <p className="text-sm text-ink-soft">Reading the file…</p>}
          {plan && file && (
            <div className="space-y-3 text-sm" data-testid="import-preview">
              <Notice tone={plan.matches.length ? "success" : "warning"} title={`${plan.matches.length} text${plan.matches.length === 1 ? "" : "s"} will be added or updated`}>
                {plan.unchangedCount > 0 && <p>{plan.unchangedCount} already match the website.</p>}
                {plan.emptyCount > 0 && <p>{plan.emptyCount} empty cell{plan.emptyCount === 1 ? " was" : "s were"} skipped.</p>}
                {Object.entries(plan.missingAfter).map(([l, n]) => <p key={l}>{languageName(l)} after import: {n === 0 ? "complete ✓" : `${n} text${n === 1 ? "" : "s"} still missing`}</p>)}
              </Notice>
              {plan.unknownRows.length > 0 && (
                <Notice tone="warning" title={`${plan.unknownRows.length} row${plan.unknownRows.length === 1 ? "" : "s"} could not be placed (they will be ignored)`}>
                  <ul className="list-disc pl-5">{plan.unknownRows.slice(0, 6).map((r) => <li key={r.row}>Row {r.row}: {r.reason}</li>)}</ul>
                </Notice>
              )}
              {plan.languagesNotOnSite.length > 0 && <Notice tone="warning">The file also contains {plan.languagesNotOnSite.map(languageName).join(", ")}, which is not on this website. Add the language first to use those texts.</Notice>}
              {plan.matches.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-brand">See where each text goes</summary>
                  <ul className="mt-2 max-h-64 divide-y overflow-y-auto rounded-lg border text-xs">
                    {plan.matches.map((m) => (
                      <li key={`${m.key}.${m.locale}`} className="p-2"><span className="font-medium">{m.page} › {m.label.replace(/ \(.*\)$/, "")} ({languageName(m.locale)})</span>{m.matchedBy !== "key" && <span className="text-amber-700"> · matched by English text</span>}<br /><span className="text-ink-soft">{m.before ? <><span className="line-through">{m.before}</span> → </> : null}{m.after}</span></li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  disabled={!plan.matches.length || pending}
                  onClick={() =>
                    start(async () => {
                      const r = await applyTranslationAction(props.siteId, file.text, file.name, fileLocale || undefined, plan.ops.length);
                      if (r.ok) { setMsg({ tone: "success", text: `${r.count} translations saved to the draft. Check the preview, then make the language visible and publish.` }); setPlan(null); setFile(null); }
                      else setMsg({ tone: "error", text: r.error });
                    })
                  }
                >
                  Use these translations
                </button>
                <button className="btn-secondary" onClick={() => { setPlan(null); setFile(null); }}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
