"use client";
/**
 * People and access.
 *
 * An operations admin adds colleagues and decides, per client, whether somebody prepares
 * content (editor) or decides when it goes live (publisher). Every row explains in plain
 * language what the choice means, and changes take effect immediately.
 */
import { useState, useTransition } from "react";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { addPersonAction, setAdminAction, setClientAccessAction } from "@/server/actions";
import type { TeamMember } from "@/server/services";
import { Modal, Notice } from "./ui";

type Client = { id: string; name: string };
type Msg = { tone: "success" | "error"; text: string } | null;

const ACCESS_OPTIONS: Array<{ value: Role | "none"; label: string }> = [
  { value: "none", label: "No access" },
  { value: "editor", label: ROLE_LABELS.editor.name },
  { value: "publisher", label: ROLE_LABELS.publisher.name },
];

export default function TeamPanel({ members, clients, workspaceName }: { members: TeamMember[]; clients: Client[]; workspaceName: string }) {
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { tone: "success", text: success } : { tone: "error", text: res.error ?? "Nothing was changed." });
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">People and access</h1>
          <p className="max-w-3xl text-sm text-ink-soft">
            Who can work on which client in <strong>{workspaceName}</strong>. People only see the clients listed for them &ndash; everything else is hidden.
            Changes apply straight away, the next time that person loads a page.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)} disabled={pending}>Add a person</button>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="p-3">Person</th>
              <th className="p-3">Operations admin</th>
              {clients.map((c) => <th key={c.id} className="p-3">{c.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.id} data-testid={`team-row-${m.email}`} className="align-top">
                <td className="p-3">
                  <div className="font-medium">{m.name}{m.isYou && <span className="pill ml-2 bg-brand-light text-brand">You</span>}</div>
                  <div className="text-xs text-ink-soft">{m.email}</div>
                  <div className="text-xs text-ink-soft">{m.title}</div>
                </td>
                <td className="p-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={m.isAdmin}
                      disabled={pending}
                      aria-label={`Operations admin: ${m.name}`}
                      onChange={(e) => run(() => setAdminAction(m.id, e.target.checked), e.target.checked ? `${m.name} is now an operations admin.` : `${m.name} is no longer an operations admin.`)}
                    />
                    {m.isAdmin ? "Every client" : "No"}
                  </label>
                </td>
                {clients.map((c) => {
                  const current = m.roles.find((r) => r.clientId === c.id)?.role ?? "none";
                  return (
                    <td key={c.id} className="p-3">
                      <select
                        className="input w-auto py-1 text-xs"
                        value={m.isAdmin ? "publisher" : current}
                        disabled={pending || m.isAdmin}
                        aria-label={`${m.name} access to ${c.name}`}
                        title={m.isAdmin ? "Operations admins can already do everything for every client." : undefined}
                        onChange={(e) => run(() => setClientAccessAction(m.id, c.id, e.target.value as Role | "none"), `${m.name} – ${c.name}: ${ACCESS_OPTIONS.find((o) => o.value === e.target.value)!.label.toLowerCase()}.`)}
                      >
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4 text-sm">
        <h2 className="font-semibold">What each choice means</h2>
        <ul className="mt-2 space-y-1 text-ink-soft">
          {(["editor", "publisher"] as const).map((r) => <li key={r}><strong className="text-ink">{ROLE_LABELS[r].name}:</strong> {ROLE_LABELS[r].summary}</li>)}
          <li><strong className="text-ink">{ROLE_LABELS.admin.name}:</strong> {ROLE_LABELS.admin.summary}</li>
        </ul>
      </div>

      {adding && (
        <AddPerson
          onClose={() => setAdding(false)}
          onDone={(name) => {
            setAdding(false);
            setMsg({ tone: "success", text: `${name} was added. Give them access to a client below, then tell them their password privately.` });
          }}
        />
      )}
    </div>
  );
}

function AddPerson({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", title: "", password: "", isAdmin: false });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: k === "isAdmin" ? e.target.checked : e.target.value });

  const submit = () =>
    start(async () => {
      const res = await addPersonAction(form);
      if (res.ok) onDone(form.name.trim());
      else setError(res.error);
    });

  return (
    <Modal title="Add a person" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-ink-soft">They sign in with this email and password. Nobody can see any client until you give them access.</p>
        <Field label="Full name" id="t-name"><input id="t-name" className="input" value={form.name} onChange={set("name")} /></Field>
        <Field label="Email (used to sign in)" id="t-email"><input id="t-email" type="email" className="input" value={form.email} onChange={set("email")} /></Field>
        <Field label="Job title" id="t-title"><input id="t-title" className="input" placeholder="e.g. Content editor" value={form.title} onChange={set("title")} /></Field>
        <Field label="First password (at least 8 characters)" id="t-pw"><input id="t-pw" className="input" value={form.password} onChange={set("password")} /></Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isAdmin} onChange={set("isAdmin")} /> Make them an operations admin (every client, every action)
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={pending}>{pending ? "Adding…" : "Add person"}</button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">{label}</label>
      {children}
    </div>
  );
}
