"use client";
/**
 * The receiving half of a transfer: upload a package exported from another workspace.
 * The website arrives as a private draft, so nothing becomes public by accident.
 */
import Link from "next/link";
import { useState, useTransition } from "react";
import { importPackageAction } from "@/server/actions";
import { Notice } from "./ui";

export default function ImportPackage({ clients, workspaceName }: { clients: Array<{ id: string; name: string }>; workspaceName: string }) {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "__new");
  const [newClient, setNewClient] = useState("");
  const [result, setResult] = useState<{ ok: true; siteId: string; name: string } | { ok: false; error: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card max-w-xl p-6">
      <h2>Bring a website into “{workspaceName}”</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">It arrives as a private draft with all its pages and languages. Nothing is public until somebody publishes it here.</p>

      <div className="mt-5 space-y-4">
        {/* One label only: a second one for the same input makes the accessible name ambiguous. */}
        <div>
          <span className="label block">Website package</span>
          <label
            htmlFor="imp-file"
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
              fileName ? "border-brand/40 bg-brand-light/50" : "border-surface-line bg-surface-sunken/50 hover:border-ink-faint"
            }`}
          >
            <span className="text-xl" aria-hidden>{fileName ? "📦" : "⇧"}</span>
            <span className="text-sm font-medium">{fileName || "Choose the .json package file"}</span>
            <span className="text-xs text-ink-soft">{fileName ? "Ready to import – or choose a different file" : "Exported from the other workspace, under Settings › Move to another workspace"}</span>
          </label>
          <input
            id="imp-file"
            type="file"
            accept=".json,application/json"
            aria-label="Website package"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                setText(await f.text());
                setFileName(f.name);
                setResult(null);
              }
            }}
          />
        </div>

        <div>
          <label className="label" htmlFor="imp-client">Add it to client</label>
          <select id="imp-client" className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ New client…</option>
          </select>
          {clientId === "__new" && (
            <input className="input mt-2" placeholder="New client name" value={newClient} onChange={(e) => setNewClient(e.target.value)} aria-label="New client name" />
          )}
        </div>

        <button
          className="btn-primary w-full"
          disabled={!text || pending || (clientId === "__new" && !newClient.trim())}
          onClick={() =>
            start(async () => {
              const r = await importPackageAction(text!, clientId === "__new" ? { newClientName: newClient } : { clientId });
              setResult("error" in r && !("siteId" in r) ? { ok: false, error: r.error } : (r as { ok: true; siteId: string; name: string }));
            })
          }
        >
          {pending ? "Importing…" : `Import ${fileName || "package"}`}
        </button>

        {result?.ok === true && (
          <Notice tone="success" title="Website imported">
            “{result.name}” is now in this workspace as a private draft, with all its pages and languages.{" "}
            <Link className="font-medium underline underline-offset-2" href={`/app/sites/${result.siteId}`}>Open it</Link> and publish when ready.
          </Notice>
        )}
        {result?.ok === false && <Notice tone="error">{result.error}</Notice>}
      </div>
    </div>
  );
}
