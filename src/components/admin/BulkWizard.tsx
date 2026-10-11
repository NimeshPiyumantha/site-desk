"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CONTACT_FIELD_LABELS, OFFER_FIELD_LABELS, type BulkPlan, type BulkTarget } from "@/lib/bulk";
import { languageName } from "@/lib/i18n/languages";
import { bulkApplyAction, bulkPreviewAction } from "@/server/actions";
import { Notice } from "./ui";

export interface BulkSiteView {
  id: string;
  name: string;
  languages: string[];
  canPublish: boolean;
  offers: Array<{ code: string; title: string; price: Record<string, string>; title_l: Record<string, string>; description: Record<string, string> }>;
  contact: { email: string; phone: string; whatsapp: string };
}

type Step = 1 | 2 | 3 | 4;

export default function BulkWizard({ sites, offers }: { sites: BulkSiteView[]; offers: Array<{ code: string; title: string; siteIds: string[] }> }) {
  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<"offer" | "contact">("offer");
  const [code, setCode] = useState(offers[0]?.code ?? "");
  const [offerField, setOfferField] = useState<"price" | "title" | "description">("price");
  const [contactField, setContactField] = useState<"email" | "phone" | "whatsapp">("phone");
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [locales, setLocales] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [single, setSingle] = useState("");
  const [plan, setPlan] = useState<BulkPlan | null>(null);
  const [publishNow, setPublishNow] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Array<{ siteName: string; siteId: string; saved: boolean; published: boolean | null; message: string }> | null>(null);
  const [pending, start] = useTransition();

  const target: BulkTarget = kind === "offer" ? { kind, code, field: offerField } : { kind, field: contactField };
  const relevant = useMemo(() => (kind === "offer" ? sites.filter((s) => s.offers.some((o) => o.code === code)) : sites), [kind, code, sites]);
  const allLocales = useMemo(() => [...new Set(relevant.filter((s) => siteIds.includes(s.id)).flatMap((s) => s.languages))], [relevant, siteIds]);
  const canPublishAll = relevant.filter((s) => siteIds.includes(s.id)).every((s) => s.canPublish);
  const value = kind === "offer" ? Object.fromEntries(locales.map((l) => [l, values[l] ?? ""])) : single;
  const currentValue = (s: BulkSiteView, l?: string) => {
    if (kind === "contact") return s.contact[contactField] || "(empty)";
    const o = s.offers.find((x) => x.code === code);
    if (!o) return "";
    const map = offerField === "price" ? o.price : offerField === "title" ? o.title_l : o.description;
    return map[l ?? ""] ?? "(no such language)";
  };

  function reset(to: Step) {
    setPlan(null);
    setResults(null);
    setError("");
    setStep(to);
  }

  function doPreview() {
    setError("");
    start(async () => {
      const r = await bulkPreviewAction(target, siteIds, kind === "offer" ? locales : [], value);
      if (r.ok) { setPlan(r.plan); setStep(4); } else setError(r.error);
    });
  }

  function doApply() {
    if (!plan) return;
    start(async () => {
      const r = await bulkApplyAction({ target, siteIds, locales: kind === "offer" ? locales : [], value, publishNow, note, expected: plan.changes.map((c) => `${c.siteId}|${c.path}|${c.before}`) });
      if (r.ok) setResults(r.results);
      else setError(r.error);
    });
  }

  const StepHead = ({ n, title, done }: { n: Step; title: string; done?: string }) => (
    <div className="flex items-center gap-3">
      <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${step === n ? "bg-brand text-white" : step > n ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-ink-soft"}`}>{step > n ? "✓" : n}</span>
      <h2 className="font-semibold">{title}</h2>
      {step > n && done && <span className="text-sm text-ink-soft">– {done}</span>}
      {step > n && !results && <button className="ml-auto text-sm text-brand underline" onClick={() => reset(n)}>Change</button>}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-4">
      <section className="card space-y-4 p-5">
        <StepHead n={1} title="What do you want to change?" done={kind === "offer" ? `${OFFER_FIELD_LABELS[offerField]} of offer ${code}` : CONTACT_FIELD_LABELS[contactField]} />
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-lg border p-4 ${kind === "offer" ? "border-brand bg-brand-light" : ""}`}><input type="radio" className="mr-2" checked={kind === "offer"} onChange={() => setKind("offer")} />An offer (price, name or description)</label>
              <label className={`cursor-pointer rounded-lg border p-4 ${kind === "contact" ? "border-brand bg-brand-light" : ""}`}><input type="radio" className="mr-2" checked={kind === "contact"} onChange={() => setKind("contact")} />Contact details</label>
            </div>
            {kind === "offer" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="b-offer">Offer</label>
                  <select id="b-offer" className="input" value={code} onChange={(e) => setCode(e.target.value)}>
                    {offers.map((o) => <option key={o.code} value={o.code}>{o.title} ({o.code}) – on {o.siteIds.length} website{o.siteIds.length === 1 ? "" : "s"}</option>)}
                  </select>
                  <p className="hint">Offers are matched by their offer code on every website you can access.</p>
                </div>
                <div>
                  <label className="label" htmlFor="b-field">Which part</label>
                  <select id="b-field" className="input" value={offerField} onChange={(e) => setOfferField(e.target.value as typeof offerField)}>
                    {Object.entries(OFFER_FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="b-contact">Which detail</label>
                <select id="b-contact" className="input sm:w-1/2" value={contactField} onChange={(e) => setContactField(e.target.value as typeof contactField)}>
                  {Object.entries(CONTACT_FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <button className="btn-primary" disabled={kind === "offer" && !code} onClick={() => { setSiteIds([]); setLocales([]); setStep(2); }}>Next: choose websites</button>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <StepHead n={2} title="Which websites and languages?" done={`${siteIds.length} website${siteIds.length === 1 ? "" : "s"}${kind === "offer" ? `, ${locales.map(languageName).join(" & ")}` : ""}`} />
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-3 text-xs"><button className="text-brand underline" onClick={() => setSiteIds(relevant.map((s) => s.id))}>Select all {relevant.length}</button><button className="text-brand underline" onClick={() => setSiteIds([])}>Select none</button></div>
            <ul className="divide-y rounded-lg border">
              {relevant.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                  <input type="checkbox" id={`bs-${s.id}`} className="mt-1 h-4 w-4 accent-brand" checked={siteIds.includes(s.id)} onChange={(e) => setSiteIds(e.target.checked ? [...siteIds, s.id] : siteIds.filter((x) => x !== s.id))} />
                  <label htmlFor={`bs-${s.id}`} className="flex-1 cursor-pointer">
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-xs text-ink-soft">
                      {kind === "offer" ? s.languages.map((l) => `${languageName(l)}: ${currentValue(s, l)}`).join(" · ") : `Now: ${currentValue(s)}`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {kind === "offer" && siteIds.length > 0 && (
              <div>
                <p className="label">Languages to change</p>
                <div className="flex flex-wrap gap-3">
                  {allLocales.map((l) => (
                    <label key={l} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" className="accent-brand" checked={locales.includes(l)} onChange={(e) => setLocales(e.target.checked ? [...locales, l] : locales.filter((x) => x !== l))} />{languageName(l)}</label>
                  ))}
                </div>
                <p className="hint">Languages you don’t tick stay exactly as they are.</p>
              </div>
            )}
            <button className="btn-primary" disabled={!siteIds.length || (kind === "offer" && !locales.length)} onClick={() => setStep(3)}>Next: new value</button>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <StepHead n={3} title="New value" done={kind === "offer" ? locales.map((l) => `${languageName(l)}: ${values[l] ?? ""}`).join(" · ") : single} />
        {step === 3 && (
          <div className="space-y-3">
            {kind === "offer" ? (
              locales.map((l) => (
                <div key={l}>
                  <label className="label" htmlFor={`bv-${l}`}>New {OFFER_FIELD_LABELS[offerField].toLowerCase()} in {languageName(l)}</label>
                  {offerField === "description" ? <textarea id={`bv-${l}`} className="input" rows={3} value={values[l] ?? ""} onChange={(e) => setValues({ ...values, [l]: e.target.value })} /> : <input id={`bv-${l}`} className="input" value={values[l] ?? ""} onChange={(e) => setValues({ ...values, [l]: e.target.value })} />}
                  <p className="hint">Example of the current text: {currentValue(relevant.find((s) => siteIds.includes(s.id) && s.languages.includes(l))!, l)}</p>
                </div>
              ))
            ) : (
              <div>
                <label className="label" htmlFor="bv-single">New {CONTACT_FIELD_LABELS[contactField].toLowerCase()}</label>
                <input id="bv-single" className="input" value={single} onChange={(e) => setSingle(e.target.value)} />
              </div>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <button className="btn-primary" disabled={pending || (kind === "offer" ? locales.some((l) => !(values[l] ?? "").trim()) : !single.trim())} onClick={doPreview}>{pending ? "Working it out…" : "Next: check exactly what will change"}</button>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <StepHead n={4} title="Check and confirm" />
        {step === 4 && plan && !results && (
          <div className="space-y-4 text-sm" data-testid="bulk-preview">
            <Notice tone={plan.changes.length ? "info" : "warning"} title={`${plan.changes.length} value${plan.changes.length === 1 ? "" : "s"} will change on ${new Set(plan.changes.map((c) => c.siteId)).size} website${new Set(plan.changes.map((c) => c.siteId)).size === 1 ? "" : "s"}`} />
            {plan.changes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full rounded-lg border text-left">
                  <thead className="bg-gray-50 text-xs uppercase text-ink-soft"><tr><th className="p-2">Website</th><th className="p-2">What</th><th className="p-2">Now</th><th className="p-2">After</th></tr></thead>
                  <tbody className="divide-y">
                    {plan.changes.map((c) => (
                      <tr key={`${c.siteId}${c.path}`}><td className="p-2 font-medium">{c.siteName}</td><td className="p-2">{c.label}</td><td className="p-2 text-red-800">{c.before}</td><td className="p-2 text-emerald-800">{c.after}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="font-semibold">Stays exactly as it is</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
                {plan.notSelected.map((s) => <li key={s.siteId}>{s.siteName} – not selected</li>)}
                {plan.languagesLeftAlone.map((s, i) => <li key={i}>{s.siteName} – {s.language} stays “{s.value}”</li>)}
                {plan.alreadyCorrect.map((s, i) => <li key={`a${i}`}>{s.siteName} – {s.label} already has this value</li>)}
                <li>Every other text, offer and language on these websites</li>
              </ul>
            </div>
            {plan.problems.length > 0 && <Notice tone="warning" title="Cannot be changed"><ul className="list-disc pl-5">{plan.problems.map((p, i) => <li key={i}>{p.siteName}: {p.message}</li>)}</ul></Notice>}
            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex items-center gap-2"><input type="radio" checked={!publishNow} onChange={() => setPublishNow(false)} /> Save to the drafts only (review and publish each website later)</label>
              <label className={`flex items-center gap-2 ${canPublishAll ? "" : "opacity-50"}`}><input type="radio" disabled={!canPublishAll} checked={publishNow} onChange={() => setPublishNow(true)} /> Publish these changes now <span className="text-xs text-ink-soft">– only these values go live; other unpublished work stays in draft</span></label>
              {!canPublishAll && <p className="text-xs text-ink-soft">You can’t publish on all selected websites – save to drafts and a reviewer will publish.</p>}
              {publishNow && <input className="input" placeholder="Note for the history (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for the history" />}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <button className="btn-primary" disabled={pending || !plan.changes.length} onClick={doApply}>{pending ? "Applying…" : publishNow ? `Publish ${plan.changes.length} changes` : `Save ${plan.changes.length} changes to drafts`}</button>
          </div>
        )}
        {results && (
          <div className="space-y-3" data-testid="bulk-results">
            <Notice tone={results.every((r) => r.saved && r.published !== false) ? "success" : "warning"} title="Done">Here is what happened on each website:</Notice>
            <ul className="divide-y rounded-lg border text-sm">
              {results.map((r) => (
                <li key={r.siteId} className="flex flex-wrap items-center gap-2 p-3">
                  <span>{r.published ? "🟢" : r.saved ? (r.published === false ? "🟠" : "📝") : "🔴"}</span>
                  <span className="font-medium">{r.siteName}</span>
                  <span className="text-ink-soft">{r.message}</span>
                  <Link className="ml-auto text-brand underline" href={`/app/sites/${r.siteId}`}>Open</Link>
                </li>
              ))}
            </ul>
            <button className="btn-secondary" onClick={() => { reset(1); setValues({}); setSingle(""); }}>Make another bulk change</button>
          </div>
        )}
      </section>
    </div>
  );
}
