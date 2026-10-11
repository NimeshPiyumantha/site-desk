"use client";
/**
 * The content editor. Changes are kept locally as a list of edit operations until "Save draft".
 * Saving sends only those operations plus the revision the editor started from, so the server can
 * combine them with colleagues' work or ask about real conflicts (see lib/content/merge.ts).
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getAt } from "@/lib/content/paths";
import { applyOps, type Conflict } from "@/lib/content/merge";
import { FieldDef, SECTIONS, SectionDef } from "@/lib/content/registry";
import type { EditOp, SiteContent } from "@/lib/content/types";
import { translationCoverage } from "@/lib/content/validate";
import { languageName } from "@/lib/i18n/languages";
import { heartbeatAction, saveDraftAction, uploadImageAction } from "@/server/actions";
import { Modal, Notice } from "./ui";

const LIBRARY = ["hero-coast", "hero-hills", "coast", "city", "nature", "beach", "villa", "tea", "train", "surf", "team"].map((n) => `/demo/${n}.svg`);

function newItemId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Editor(props: { siteId: string; initial: SiteContent; revision: number; canEdit: boolean; initialSection?: string; initialLocale?: string }) {
  const [content, setContent] = useState(props.initial);
  const [base, setBase] = useState(props.revision);
  const [ops, setOps] = useState<EditOp[]>([]);
  const main = content.settings.defaultLanguage;
  const langs = content.settings.languages.map((l) => l.id);
  const [locale, setLocale] = useState(props.initialLocale && langs.includes(props.initialLocale) ? props.initialLocale : main);
  const [sectionId, setSectionId] = useState(SECTIONS.some((s) => s.id === props.initialSection) ? props.initialSection! : "hero");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [conflict, setConflict] = useState<{ conflicts: Conflict[]; revision: number; server: SiteContent; byWhom: string } | null>(null);
  const [presence, setPresence] = useState<{ editors: string[]; newer: boolean; lastBy: string | null }>({ editors: [], newer: false, lastBy: null });
  const [pending, start] = useTransition();
  const baseRef = useRef(base);
  baseRef.current = base;

  const section = SECTIONS.find((s) => s.id === sectionId)!;
  const dirty = ops.length > 0;
  const coverage = useMemo(() => (locale === main ? null : translationCoverage(content, locale)), [content, locale, main]);
  const missingKeys = useMemo(() => new Set(coverage?.missing.map((m) => m.key) ?? []), [coverage]);

  // Presence + "someone saved" polling.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const res = await heartbeatAction(props.siteId);
      if (alive && res.ok) setPresence({ editors: res.editors, newer: res.revision > baseRef.current, lastBy: res.lastBy });
    };
    tick();
    const t = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [props.siteId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const apply = useCallback((op: EditOp) => {
    setContent((c) => applyOps(c, [op]).content);
    setOps((prev) => (op.op === "set" ? [...prev.filter((o) => !(o.op === "set" && o.path === op.path)), op] : [...prev, op]));
    setMessage(null);
  }, []);

  function save(opsToSend = ops, fromRevision = base, extra = "") {
    start(async () => {
      const res = await saveDraftAction(props.siteId, fromRevision, opsToSend);
      if ("error" in res && res.ok === false) {
        setMessage({ tone: "error", text: res.error });
        return;
      }
      if (res.ok) {
        setContent(res.content);
        setBase(res.revision);
        setOps([]);
        setConflict(null);
        setPresence((p) => ({ ...p, newer: false }));
        setMessage({ tone: "success", text: `Saved to the draft. Nothing is live until it is published.${res.mergedWithOthers ? ` Your changes were combined with ${res.mergedWithOthers} change${res.mergedWithOthers === 1 ? "" : "s"} a colleague saved meanwhile.` : ""}${extra}` });
      } else if ("conflicts" in res) {
        setConflict({ conflicts: res.conflicts, revision: res.revision, server: res.content, byWhom: res.byWhom });
      }
    });
  }

  function resolve(choices: Record<string, "mine" | "theirs">) {
    if (!conflict) return;
    const theirs = new Set(Object.entries(choices).filter(([, v]) => v === "theirs").map(([k]) => k));
    const kept = ops.filter((o) => {
      if (o.op === "set") return !theirs.has(o.path) && !conflict.conflicts.some((c) => c.reason === "item-removed" && c.path === o.path);
      if (o.op === "removeItem") return !theirs.has(`${o.list}.@${o.id}`);
      return true;
    });
    setContent(applyOps(conflict.server, kept).content);
    setOps(kept);
    setBase(conflict.revision);
    setConflict(null);
    if (kept.length) save(kept, conflict.revision, ` Your choices were combined with ${conflict.byWhom}’s other changes.`);
    else setMessage({ tone: "info", text: "You kept your colleague’s version. The editor now shows the latest draft." });
  }

  return (
    <div className="space-y-4">
      {presence.editors.length > 0 && (
        <Notice tone="warning">👥 {presence.editors.join(", ")} {presence.editors.length === 1 ? "is" : "are"} also editing this website right now. Your changes will be combined with theirs; if you both change the same text, you will be asked which to keep.</Notice>
      )}
      {presence.newer && (
        <Notice tone="info">
          {presence.lastBy ?? "A colleague"} saved changes to this draft. {dirty ? "When you save, your changes will be combined with theirs." : ""}{" "}
          {!dirty && <button className="underline" onClick={() => window.location.reload()}>Load the latest version</button>}
        </Notice>
      )}
      {!props.canEdit && <Notice tone="info">You can view this content but you cannot change it.</Notice>}

      <div className="sticky top-[57px] z-20 -mx-4 flex flex-wrap items-center gap-3 border-b bg-gray-50/95 px-4 py-3 backdrop-blur">
        <span className="text-sm font-medium">Editing language:</span>
        <div className="flex overflow-hidden rounded-lg border bg-white text-sm" role="tablist">
          {langs.map((l) => {
            const missing = l === main ? 0 : translationCoverage(content, l).missing.length;
            return (
              <button key={l} role="tab" aria-selected={l === locale} onClick={() => setLocale(l)} className={`px-3 py-1.5 ${l === locale ? "bg-brand text-white" : "hover:bg-gray-50"}`}>
                {languageName(l)}
                {missing > 0 && <span className={`ml-1 rounded-full px-1.5 text-xs ${l === locale ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{missing} missing</span>}
              </button>
            );
          })}
        </div>
        <Link href={`/app/sites/${props.siteId}/languages`} className="text-xs text-brand underline">+ Add a language</Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-ink-soft" aria-live="polite">{dirty ? `${ops.length} unsaved change${ops.length === 1 ? "" : "s"}` : "All changes saved"}</span>
          <a href={`/preview/${props.siteId}/${locale}`} target="_blank" className="btn-secondary">👁 Preview</a>
          <button className="btn-primary" disabled={!dirty || pending || !props.canEdit} onClick={() => save()}>{pending ? "Saving…" : "Save draft"}</button>
        </div>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1" aria-label="Sections">
          {SECTIONS.map((s) => {
            const missing = coverage ? coverage.missing.filter((m) => m.key.startsWith(`${s.id}.`)).length : 0;
            return (
              <button key={s.id} onClick={() => setSectionId(s.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${s.id === sectionId ? "bg-brand-light font-medium text-brand" : "hover:bg-gray-100"}`}>
                <span>{s.label}</span>
                {missing > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">{missing}</span>}
              </button>
            );
          })}
        </nav>

        <section className="card p-5" aria-label={section.label}>
          <h2 className="text-lg font-semibold">{section.label}</h2>
          <p className="text-sm text-ink-soft">{section.description} <span className="text-ink-faint">· {section.page === "all" ? "Every page" : section.page === "about" ? "About page" : "Home page"}</span></p>
          <fieldset disabled={!props.canEdit} className="mt-5 space-y-5">
            {section.fields.map((f) => (
              <Field key={f.key} field={f} path={`${section.id}.${f.key}`} content={content} locale={locale} main={main} missing={missingKeys.has(`${section.id}.${f.key}`)} onChange={apply} />
            ))}
            {section.list && <ListEditor section={section} content={content} locale={locale} main={main} missingKeys={missingKeys} onChange={apply} />}
          </fieldset>
        </section>
      </div>

      {conflict && <ConflictDialog conflict={conflict} onResolve={resolve} onClose={() => setConflict(null)} />}
    </div>
  );
}

function Field({ field, path, content, locale, main, missing, onChange }: { field: FieldDef; path: string; content: SiteContent; locale: string; main: string; missing: boolean; onChange: (op: EditOp) => void }) {
  const fullPath = field.localized ? `${path}.${locale}` : path;
  const id = `f-${fullPath}`;
  const value = getAt(content, fullPath);
  const reference = field.localized && locale !== main ? String(getAt(content, `${path}.${main}`) ?? "") : null;
  const set = (v: string | boolean) => onChange({ op: "set", path: fullPath, value: v });
  return (
    <div>
      <label htmlFor={id} className="label flex flex-wrap items-center gap-2">
        {field.label}
        {field.localized ? <span className="pill bg-gray-100 text-ink-soft">{languageName(locale)}</span> : field.type !== "toggle" && <span className="pill bg-gray-100 text-ink-faint">same in all languages</span>}
        {field.private && <span className="pill bg-violet-100 text-violet-800" title="Not copied to new campaigns">private to client</span>}
        {missing && <span className="pill bg-amber-100 text-amber-800">missing translation</span>}
      </label>
      {reference !== null && <p className="mb-1 rounded bg-gray-50 px-2 py-1 text-xs text-ink-soft">{languageName(main)}: {reference || "(empty)"}</p>}
      {field.type === "longtext" ? (
        <textarea id={id} className={`input ${missing ? "border-amber-400" : ""}`} rows={3} value={String(value ?? "")} onChange={(e) => set(e.target.value)} />
      ) : field.type === "toggle" ? (
        <label className="flex items-center gap-2 text-sm"><input id={id} type="checkbox" className="h-4 w-4 accent-brand" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} /> {value ? "Shown" : "Hidden"}</label>
      ) : field.type === "color" ? (
        <div className="flex items-center gap-2"><input type="color" aria-label={`${field.label} picker`} value={String(value || "#000000")} onChange={(e) => set(e.target.value)} className="h-9 w-12 rounded border" /><input id={id} className="input w-32" value={String(value ?? "")} onChange={(e) => set(e.target.value)} /></div>
      ) : field.type === "image" ? (
        <ImagePicker id={id} value={String(value ?? "")} onChange={set} />
      ) : (
        <input
          id={id}
          className={`input ${missing ? "border-amber-400" : ""} ${field.type === "code" ? "font-mono uppercase" : ""}`}
          type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
          placeholder={field.type === "url" ? "https://…" : undefined}
          value={String(value ?? "")}
          onChange={(e) => set(field.type === "code" ? e.target.value.toUpperCase() : e.target.value)}
        />
      )}
      {field.help && <p className="hint">{field.help}</p>}
    </div>
  );
}

function ImagePicker({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {value ? <img src={value} alt="" className="h-20 w-32 rounded border object-cover" /> : <div className="grid h-20 w-32 place-items-center rounded border border-dashed text-xs text-ink-faint">No picture</div>}
      <div className="flex flex-col gap-1">
        <label className="btn-secondary cursor-pointer" htmlFor={id}>{busy ? "Uploading…" : "Upload a picture"}</label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            const fd = new FormData();
            fd.append("file", file);
            const res = await uploadImageAction(fd);
            setBusy(false);
            if (res.ok) onChange(res.url);
            else setError(res.error);
          }}
        />
        <button type="button" className="text-left text-xs text-brand underline" onClick={() => setOpen(!open)}>Choose from picture library</button>
        {value && <button type="button" className="text-left text-xs text-ink-soft underline" onClick={() => onChange("")}>Remove</button>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
      {open && (
        <div className="grid w-full grid-cols-4 gap-2 sm:grid-cols-6">
          {LIBRARY.map((src) => (
            <button type="button" key={src} onClick={() => { onChange(src); setOpen(false); }} className={`overflow-hidden rounded border-2 ${src === value ? "border-brand" : "border-transparent"}`}>
              <img src={src} alt={src.split("/").pop()} className="h-14 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ListEditor({ section, content, locale, main, missingKeys, onChange }: { section: SectionDef; content: SiteContent; locale: string; main: string; missingKeys: Set<string>; onChange: (op: EditOp) => void }) {
  const list = section.list!;
  const listPath = `${section.id}.${list.key}`;
  const items = (getAt(content, listPath) as Array<Record<string, unknown> & { id: string }>) ?? [];
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  function addItem() {
    const item: Record<string, unknown> & { id: string } = { id: newItemId(list.itemLabel.toLowerCase().split(" ")[0]) };
    for (const f of list.fields) {
      if (f.localized) item[f.key] = Object.fromEntries(content.settings.languages.map((l) => [l.id, ""]));
      else item[f.key] = f.type === "image" ? LIBRARY[2] : "";
    }
    onChange({ op: "addItem", list: listPath, item });
  }

  return (
    <div className="space-y-4 border-t pt-5">
      <h3 className="font-medium">{list.itemLabel}s ({items.length})</h3>
      {items.map((item, idx) => {
        const title = (item[list.titleField] as Record<string, string>)?.[main] || `New ${list.itemLabel.toLowerCase()}`;
        return (
          <div key={item.id} className="rounded-lg border p-4" data-testid={`item-${item.id}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium">{idx + 1}. {title}</span>
              <div className="ml-auto flex gap-1">
                <button type="button" className="btn-ghost px-2 py-1" disabled={idx === 0} onClick={() => onChange({ op: "moveItem", list: listPath, id: item.id, toIndex: idx - 1 })} aria-label="Move up">↑</button>
                <button type="button" className="btn-ghost px-2 py-1" disabled={idx === items.length - 1} onClick={() => onChange({ op: "moveItem", list: listPath, id: item.id, toIndex: idx + 1 })} aria-label="Move down">↓</button>
                <button type="button" className="btn-ghost px-2 py-1 text-red-700" disabled={items.length <= (list.min ?? 0)} onClick={() => setConfirmRemove(item.id)}>Remove</button>
              </div>
            </div>
            <div className="space-y-4">
              {list.fields.map((f) => (
                <Field key={f.key} field={f} path={`${listPath}.@${item.id}.${f.key}`} content={content} locale={locale} main={main} missing={missingKeys.has(`${listPath}.@${item.id}.${f.key}`)} onChange={onChange} />
              ))}
            </div>
          </div>
        );
      })}
      <button type="button" className="btn-secondary" disabled={items.length >= (list.max ?? 99)} onClick={addItem}>+ Add {list.itemLabel.toLowerCase()}</button>
      {confirmRemove && (
        <Modal title={`Remove this ${list.itemLabel.toLowerCase()}?`} onClose={() => setConfirmRemove(null)}>
          <p className="text-sm">It will be removed from the draft in every language. The live website does not change until you publish, and you can always go back to an earlier version.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setConfirmRemove(null)}>Keep it</button>
            <button className="btn-danger" onClick={() => { onChange({ op: "removeItem", list: listPath, id: confirmRemove }); setConfirmRemove(null); }}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ConflictDialog({ conflict, onResolve, onClose }: { conflict: { conflicts: Conflict[]; byWhom: string }; onResolve: (c: Record<string, "mine" | "theirs">) => void; onClose: () => void }) {
  const [choices, setChoices] = useState<Record<string, "mine" | "theirs">>(() => Object.fromEntries(conflict.conflicts.map((c) => [c.path, c.reason === "item-removed" ? "theirs" : "mine"])));
  return (
    <Modal title="A colleague changed the same text" onClose={onClose} wide>
      <p className="text-sm">{conflict.byWhom} saved changes while you were editing. Most of your changes can be combined automatically, but these were changed by both of you. Choose which version to keep for each one:</p>
      <div className="mt-4 space-y-3">
        {conflict.conflicts.map((c) => (
          <div key={c.path} className="rounded-lg border p-3 text-sm" data-testid="conflict">
            <p className="font-medium">{c.label}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-lg border p-3 ${choices[c.path] === "mine" ? "border-brand bg-brand-light" : ""} ${c.reason === "item-removed" ? "opacity-50" : ""}`}>
                <input type="radio" name={c.path} className="mr-2" disabled={c.reason === "item-removed"} checked={choices[c.path] === "mine"} onChange={() => setChoices({ ...choices, [c.path]: "mine" })} />
                <strong>Keep mine:</strong> <span className="break-words">{c.yours}</span>
              </label>
              <label className={`cursor-pointer rounded-lg border p-3 ${choices[c.path] === "theirs" ? "border-brand bg-brand-light" : ""}`}>
                <input type="radio" name={c.path} className="mr-2" checked={choices[c.path] === "theirs"} onChange={() => setChoices({ ...choices, [c.path]: "theirs" })} />
                <strong>Keep {conflict.byWhom.split(",")[0]}’s:</strong> <span className="break-words">{c.theirs}</span>
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Decide later</button>
        <button className="btn-primary" onClick={() => onResolve(choices)}>Save with these choices</button>
      </div>
    </Modal>
  );
}
