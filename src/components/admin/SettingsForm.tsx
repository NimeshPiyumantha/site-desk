"use client";
/**
 * Everything about one website that is not its content: name, web address, analytics IDs,
 * internal notes, the transfer package, and the demo switch for a failed launch.
 *
 * Grouped into one card per topic so a non-technical person can find the thing they came for
 * without reading the whole page.
 */
import { useState, useTransition } from "react";
import { validateGaId, validateGtmId } from "@/lib/content/validate";
import { exportPackageAction, simulateFailureAction, updateSettingsAction } from "@/server/actions";
import { Notice } from "./ui";

function Section({ title, description, children, tone }: { title: string; description?: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <section className={`card p-5 ${tone === "danger" ? "border-dashed border-stop/40 bg-stop-light/30" : ""}`}>
      <h2>{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function SettingsForm(props: {
  siteId: string; name: string; slug: string; notes: string; gaId: string; gtmId: string;
  liveGa: string; liveGtm: string; canSettings: boolean; canTransfer: boolean; simulateFailure: boolean; isLive: boolean;
}) {
  const [v, setV] = useState({ name: props.name, slug: props.slug, notes: props.notes, gaId: props.gaId, gtmId: props.gtmId });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [includeContact, setIncludeContact] = useState(false);
  const [includeAnalytics, setIncludeAnalytics] = useState(false);
  const gaErr = validateGaId(v.gaId.trim().toUpperCase());
  const gtmErr = validateGtmId(v.gtmId.trim().toUpperCase());
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateSettingsAction(props.siteId, v);
            setMsg(r.ok ? { tone: "success", text: "Saved. Analytics changes go live with the next publish." } : { tone: "error", text: "error" in r ? r.error : "" });
          });
        }}
      >
        <fieldset disabled={!props.canSettings} className="space-y-5">
          <Section title="Website details" description="The name your team sees in SiteDesk, and the address visitors use.">
            <div>
              <label className="label" htmlFor="s-name">Website name (internal)</label>
              <input id="s-name" className="input" value={v.name} onChange={set("name")} />
            </div>
            <div>
              <label className="label" htmlFor="s-slug">Web address</label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-lg bg-surface-sunken px-2.5 py-2.5 font-mono text-sm text-ink-soft">/s/</span>
                <input id="s-slug" className="input font-mono" value={v.slug} onChange={set("slug")} />
              </div>
              {props.isLive && v.slug !== props.slug && (
                <p className="mt-2 rounded-lg bg-draft-light px-3 py-2 text-xs leading-relaxed text-draft">
                  ⚠ This website is live. Changing its address breaks links people have saved and bookmarked, and search results until Google catches up.
                </p>
              )}
            </div>
          </Section>

          <Section title="Analytics" description="Paste the IDs from Google. They are added to the public pages with your next publish.">
            <div>
              <label className="label" htmlFor="s-ga">Google Analytics Measurement ID</label>
              <input id="s-ga" className={`input font-mono ${gaErr ? "border-stop" : ""}`} value={v.gaId} onChange={set("gaId")} placeholder="G-XXXXXXXXXX" />
              {gaErr ? <p className="mt-1.5 text-xs text-stop">{gaErr}</p> : <p className="hint">Where to find it: Google Analytics › Admin › Data streams › your website. Live now: <strong className="font-medium text-ink">{props.liveGa || "none"}</strong></p>}
            </div>
            <div>
              <label className="label" htmlFor="s-gtm">Google Tag Manager container ID</label>
              <input id="s-gtm" className={`input font-mono ${gtmErr ? "border-stop" : ""}`} value={v.gtmId} onChange={set("gtmId")} placeholder="GTM-XXXXXXX" />
              {gtmErr ? <p className="mt-1.5 text-xs text-stop">{gtmErr}</p> : <p className="hint">Shown at the top of your Tag Manager workspace. Live now: <strong className="font-medium text-ink">{props.liveGtm || "none"}</strong></p>}
            </div>
          </Section>

          <Section title="Internal notes" description="Only your team sees these. They are never public and never copied to a new campaign.">
            <div>
              <label className="label" htmlFor="s-notes">Notes about this client</label>
              <textarea id="s-notes" className="input" rows={3} value={v.notes} onChange={set("notes")} />
            </div>
          </Section>

          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

          {/* In normal flow, not floating: a sticky button sat on top of the notes field. */}
          <div className="flex items-center justify-end gap-3">
            {(gaErr || gtmErr) && <span className="text-xs text-stop">Correct the highlighted ID before saving.</span>}
            <button className="btn-primary" disabled={pending || Boolean(gaErr) || Boolean(gtmErr)}>
              {pending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </fieldset>
        {!props.canSettings && <Notice tone="info">Only reviewers and operations admins can change these settings.</Notice>}
      </form>

      <div className="space-y-5">
        {props.canTransfer && (
          <Section
            title="Move to another workspace"
            description="Downloads one file holding every page, language, picture reference, the draft and the live version. Upload it on the Transfer page of the other workspace – nothing has to be rebuilt."
          >
            <div className="rounded-xl border border-surface-line bg-surface-sunken/60 p-4">
              <p className="section-title">Choose what travels with it</p>
              <label className="mt-2.5 flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={includeContact} onChange={(e) => setIncludeContact(e.target.checked)} />
                <span>Contact details <span className="text-ink-soft">(email, phone, WhatsApp, address)</span></span>
              </label>
              <label className="mt-2 flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={includeAnalytics} onChange={(e) => setIncludeAnalytics(e.target.checked)} />
                <span>Analytics IDs <span className="text-ink-soft">(Google Analytics and Tag Manager)</span></span>
              </label>
              <p className="mt-3 border-t border-surface-line pt-3 text-xs leading-relaxed text-ink-soft">
                <strong className="font-medium text-ink">Never included:</strong> enquiries from visitors, team members and their access, internal notes, and who made each past change.
              </p>
            </div>
            <button
              className="btn-secondary"
              onClick={() =>
                start(async () => {
                  const r = await exportPackageAction(props.siteId, { includeContact, includeAnalytics });
                  if (!r.ok) return setMsg({ tone: "error", text: "error" in r ? r.error : "" });
                  const blob = new Blob([r.json], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = r.fileName;
                  a.click();
                })
              }
            >
              ⇩ Download website package
            </button>
          </Section>
        )}

        {props.canSettings && (
          <Section
            title="Demo: simulate a failed launch"
            tone="danger"
            description="For the assessment only. When this is on, the next publish of this website fails at the hosting step – so you can see exactly what the team is told, and that the live website keeps working. It switches itself off again after one failure."
          >
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-stop"
                defaultChecked={props.simulateFailure}
                onChange={(e) => start(async () => { await simulateFailureAction(props.siteId, e.target.checked); })}
                data-testid="simulate-failure"
              />
              Make the next launch fail
            </label>
          </Section>
        )}
      </div>
    </div>
  );
}
