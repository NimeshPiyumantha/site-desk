"use client";
import { useState, useTransition } from "react";
import type { DisplayChange } from "@/lib/content/diff";
import { restoreReleaseAction } from "@/server/actions";
import { Modal, Notice } from "./ui";

export default function RestoreButton(props: { siteId: string; releaseId: string; number: number; liveNumber: number; summary: string; changes: DisplayChange[] }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {props.changes.length === 0 && !open ? <p className="text-xs text-ink-soft">Same content as the live website.</p> : <button className="btn-secondary py-1.5" onClick={() => { setOpen(true); setMsg(null); }}>↩ Go back to this version</button>}
      {open && (
        <Modal title={`Go back to version ${props.number}?`} onClose={() => setOpen(false)} wide>
          {msg ? (
            <>
              <Notice tone={msg.tone}>{msg.text}</Notice>
              <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={() => setOpen(false)}>Close</button></div>
            </>
          ) : (
            <>
              <p className="text-sm">Visitors currently see <strong>version {props.liveNumber}</strong>. Going back makes the content of version {props.number} (“{props.summary}”) live again, as a new version. Nothing is deleted – you can always go forward again.</p>
              <h3 className="mt-4 text-sm font-semibold">What will change on the live website ({props.changes.length})</h3>
              <ul className="mt-2 max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
                {props.changes.map((c) => (
                  <li key={c.id} className="p-3">
                    <p className="font-medium">{c.label}</p>
                    {c.kind === "field" ? <p className="text-ink-soft"><span className="text-red-800 line-through">{c.before}</span> → <span className="text-emerald-800">{c.after}</span></p> : <p className="text-ink-soft">{c.detail}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-soft">The same texts are also corrected in the draft, so the mistake is not published again by accident. Other unpublished work in the draft is kept.</p>
              <label className="label mt-4" htmlFor="restore-note">Why? (shown in the history)</label>
              <input id="restore-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Wrong price was published" />
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button
                  className="btn-primary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await restoreReleaseAction(props.siteId, props.releaseId, note);
                      if (res.ok) setMsg({ tone: "success", text: `Done. Version ${props.number}’s content is live again as version ${res.releaseNumber}.` });
                      else if ("kind" in res && res.kind === "failed") setMsg({ tone: "error", text: `The launch failed: ${res.error.whatHappened} Visitors still see version ${props.liveNumber}. ${res.error.whatToDo}` });
                      else if ("kind" in res && res.kind === "blocked") setMsg({ tone: "error", text: res.issues.map((i) => i.message).join(" ") });
                      else setMsg({ tone: "error", text: "message" in res ? res.message : "error" in res ? res.error : "Could not restore." });
                    })
                  }
                >
                  {pending ? "Restoring…" : `Yes, make version ${props.number} live`}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
