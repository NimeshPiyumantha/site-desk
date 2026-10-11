"use client";
import { useState, useTransition } from "react";
import { slugify } from "@/lib/clone";
import { copySiteAction } from "@/server/actions";
import { Modal, Notice } from "./ui";

export default function CopySiteButton(props: { siteId: string; siteName: string; defaultClientId: string; clients: Array<{ id: string; name: string }>; isAdmin: boolean; privateItems: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [clientId, setClientId] = useState(props.clients.some((c) => c.id === props.defaultClientId) ? props.defaultClientId : props.clients[0]?.id ?? "__new");
  const [newClient, setNewClient] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!props.clients.length && !props.isAdmin) return null;
  return (
    <>
      <button className={props.className ?? "btn-secondary"} onClick={() => setOpen(true)}>⧉ Copy for new campaign</button>
      {open && (
        <Modal title={`New campaign from “${props.siteName}”`} onClose={() => setOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              start(async () => {
                const res = await copySiteAction(props.siteId, { name, slug, clientId: clientId === "__new" ? undefined : clientId, newClientName: clientId === "__new" ? newClient : undefined });
                if (res && !res.ok) setError(res.error);
              });
            }}
          >
            <div>
              <label className="label" htmlFor="copy-name">Name of the new website</label>
              <input id="copy-name" className="input" required autoFocus value={name} placeholder="e.g. Misty Mountain Retreats" onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
            </div>
            <div>
              <label className="label" htmlFor="copy-slug">Web address</label>
              <div className="flex items-center gap-1 text-sm"><span className="text-ink-soft">/s/</span><input id="copy-slug" className="input" required value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} /></div>
              <p className="hint">Lowercase letters, numbers and dashes. You can change it later.</p>
            </div>
            <div>
              <label className="label" htmlFor="copy-client">Client</label>
              <select id="copy-client" className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {props.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {props.isAdmin && <option value="__new">+ New client…</option>}
              </select>
              {clientId === "__new" && <input className="input mt-2" required placeholder="New client name" value={newClient} onChange={(e) => setNewClient(e.target.value)} aria-label="New client name" />}
            </div>
            <Notice tone="info" title="What is copied">
              Pages, texts, offers, pictures, colours and languages – ready to adapt.
              <p className="mt-2 font-semibold">Never copied (private to the original client):</p>
              <ul className="list-disc pl-5">{props.privateItems.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="mt-2">The new website is not public until you publish it. The original website is not changed.</p>
            </Notice>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create copy"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
