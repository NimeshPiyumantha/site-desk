"use client";
/**
 * Backups: a full copy of the live website and the draft at one moment.
 *
 * Restoring is the most destructive thing a non-technical person can do here, so the dialog
 * always answers two questions first — what will visitors see, and what happens to unpublished
 * work — before the button can be pressed.
 */
import { useState, useTransition } from "react";
import type { DisplayChange } from "@/lib/content/diff";
import { createBackupAction, restoreBackupAction } from "@/server/actions";
import { Modal, Notice } from "./ui";

export interface BackupView {
  id: string;
  label: string;
  kind: string;
  when: string;
  by: string;
  liveNumber: number | null;
  preview: { liveChanges: DisplayChange[]; draftChanges: DisplayChange[]; backupHasLive: boolean; currentLiveNumber: number | null };
}

const KIND: Record<string, { label: string; icon: string; tone: string }> = {
  automatic: { label: "Automatic, before publishing", icon: "⟳", tone: "pill-quiet" },
  manual: { label: "Made by a person", icon: "✎", tone: "pill-live" },
  safety: { label: "Safety copy, before a restore", icon: "🛟", tone: "pill-draft" },
  imported: { label: "Imported from another workspace", icon: "⇥", tone: "pill-quiet" },
};

export default function BackupsPanel({ siteId, backups, canBackup, canRestore }: { siteId: string; backups: BackupView[]; canBackup: boolean; canRestore: boolean }) {
  const [label, setLabel] = useState("");
  const [restoring, setRestoring] = useState<BackupView | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <div>
        <h2>Backups</h2>
        <p className="page-lead">
          A backup holds <strong>both</strong> the live website and the draft as they were at that moment. One is taken automatically before every publish, so there is always a way back.
        </p>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {canBackup && (
        <form
          className="card flex flex-wrap items-end gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createBackupAction(siteId, label);
              setMsg(r.ok ? { tone: "success", text: "Backup created." } : { tone: "error", text: "error" in r ? r.error : "" });
              setLabel("");
            });
          }}
        >
          <div className="min-w-[260px] flex-1">
            <label className="label" htmlFor="bk-label">Make a backup now</label>
            <input id="bk-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name it, e.g. Before December campaign" />
            <p className="hint">A name you will recognise later is worth more than the date.</p>
          </div>
          <button className="btn-secondary" disabled={pending}>Create backup</button>
        </form>
      )}

      <ul className="card divide-y divide-surface-line">
        {backups.length === 0 && <li className="p-6 text-center text-sm text-ink-soft">No backups yet. One is made automatically the first time you publish.</li>}
        {backups.map((b) => {
          const kind = KIND[b.kind] ?? { label: b.kind, icon: "•", tone: "pill-quiet" };
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-surface-sunken/60">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-sunken text-base" aria-hidden>{kind.icon}</span>
              <div className="min-w-[220px] flex-1">
                <p className="font-medium">{b.label}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {b.when} · {b.by}
                  {b.liveNumber ? <> · live was <strong className="font-medium text-ink">version {b.liveNumber}</strong></> : null}
                </p>
              </div>
              <span className={kind.tone}>{kind.label}</span>
              {canRestore && (
                <button className="btn-secondary py-2" onClick={() => { setRestoring(b); setMsg(null); }}>
                  Restore…
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {restoring && (
        <Modal title={`Restore “${restoring.label}”?`} onClose={() => setRestoring(null)} wide>
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-surface-line bg-surface-sunken/50 p-4">
                <p className="section-title">What visitors see</p>
                {restoring.preview.backupHasLive ? (
                  restoring.preview.liveChanges.length ? (
                    <p className="mt-2 leading-relaxed">
                      Will be <strong>replaced</strong>: {restoring.preview.liveChanges.length} change{restoring.preview.liveChanges.length === 1 ? "" : "s"} compared with what is live now (version {restoring.preview.currentLiveNumber}). It goes live immediately as a new version.
                    </p>
                  ) : (
                    <p className="mt-2 leading-relaxed">Already the same as this backup – nothing changes for visitors.</p>
                  )
                ) : (
                  <p className="mt-2 leading-relaxed">This backup has no live version, so the live website is not touched.</p>
                )}
              </div>
              <div className="rounded-xl border border-surface-line bg-surface-sunken/50 p-4">
                <p className="section-title">Unpublished work (the draft)</p>
                {restoring.preview.draftChanges.length ? (
                  <p className="mt-2 leading-relaxed">
                    Will be <strong>replaced</strong> by the backup’s draft: {restoring.preview.draftChanges.length} difference{restoring.preview.draftChanges.length === 1 ? "" : "s"}. Anything not in the backup is replaced.
                  </p>
                ) : (
                  <p className="mt-2 leading-relaxed">Already the same as the backup.</p>
                )}
              </div>
            </div>

            {restoring.preview.liveChanges.length > 0 && (
              <details open className="rounded-xl border border-surface-line">
                <summary className="cursor-pointer px-4 py-3 font-medium">Changes visitors will see ({restoring.preview.liveChanges.length})</summary>
                <ul className="max-h-56 divide-y divide-surface-line overflow-y-auto border-t border-surface-line">
                  {restoring.preview.liveChanges.map((c) => (
                    <li key={c.id} className="px-4 py-2.5">
                      <span className="font-medium">{c.label}</span>
                      <br />
                      <span className="text-ink-soft">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <Notice tone="info">
              A safety copy of the current state is taken first, so this restore can itself be undone. Enquiries, team access, version history and other backups are not affected.
            </Notice>

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => setRestoring(null)}>Cancel</button>
              <button
                className="btn-danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await restoreBackupAction(siteId, restoring.id);
                    setRestoring(null);
                    if (r.ok) setMsg({ tone: "success", text: r.releaseNumber ? `Website restored. The backup’s content is live as version ${r.releaseNumber}.` : "Draft restored from the backup. The live website was not changed." });
                    else if ("kind" in r && r.kind === "failed") setMsg({ tone: "error", text: `Restore failed during launch: ${r.error.whatHappened} The live website is unchanged.` });
                    else if ("kind" in r && r.kind === "blocked") setMsg({ tone: "error", text: r.issues.map((i) => i.message).join(" ") });
                    else setMsg({ tone: "error", text: "message" in r ? r.message : "error" in r ? r.error : "" });
                  })
                }
              >
                {pending ? "Restoring…" : "Restore this backup"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
