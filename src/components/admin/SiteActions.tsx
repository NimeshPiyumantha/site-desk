"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ChecklistItem } from "@/lib/clone";
import { cancelReviewAction, hideChecklistAction, requestReviewAction, retryLaunchAction, tickChecklistAction } from "@/server/actions";
import { Notice } from "./ui";

export function RetryLaunchButton({ siteId, releaseId }: { siteId: string; releaseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <button
        className="btn-danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await retryLaunchAction(siteId, releaseId);
            if (res.ok) router.replace(`/app/sites/${siteId}?launched=${res.releaseNumber}`);
            else if ("kind" in res && res.kind === "failed") setMsg({ tone: "error", text: `It failed again: ${res.error.whatHappened} ${res.error.whatToDo}` });
            else if ("kind" in res && res.kind === "blocked") setMsg({ tone: "error", text: res.issues.map((i) => i.message).join(" ") });
            else setMsg({ tone: "error", text: "message" in res ? res.message : "error" in res ? res.error : "Could not retry." });
          })
        }
      >
        {pending ? "Trying again…" : "↻ Try again"}
      </button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

export function ReviewBox(props: { siteId: string; state: "editing" | "ready"; requestedBy: string | null; note: string | null; pendingCount: number; canPublish: boolean; canRequest: boolean; firstLaunch?: boolean }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (props.state === "ready") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Waiting for review</p>
        <p className="mt-1">{props.requestedBy} sent {props.pendingCount} change{props.pendingCount === 1 ? "" : "s"} for review{props.note ? `: “${props.note}”` : "."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.canPublish && <Link href={`/app/sites/${props.siteId}/publish`} className="btn-primary">Review & publish</Link>}
          {props.canRequest && <button className="btn-secondary" disabled={pending} onClick={() => start(async () => { await cancelReviewAction(props.siteId); })}>Withdraw request</button>}
        </div>
      </div>
    );
  }
  if (!props.pendingCount) return <p className="text-sm text-ink-soft">No unpublished changes. Edit the content to prepare the next update.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p>{props.firstLaunch ? "This website has not been launched yet. Check the preview in every language, then launch it." : `${props.pendingCount} change${props.pendingCount === 1 ? " is" : "s are"} saved in the draft and not live yet.`}</p>
      {props.canPublish ? (
        <Link href={`/app/sites/${props.siteId}/publish`} className="btn-primary">{props.firstLaunch ? "Review & launch" : "Review & publish"}</Link>
      ) : (
        props.canRequest && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await requestReviewAction(props.siteId, note); if (!r.ok) setError("error" in r ? r.error : ""); }); }}>
            <label className="label" htmlFor="review-note">Message for the reviewer (optional)</label>
            <input id="review-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New prices from the client’s email of 10 Oct" />
            <button className="btn-primary" disabled={pending}>Send for review</button>
            <p className="hint">A reviewer checks your changes and decides when they go live.</p>
            {error && <Notice tone="error">{error}</Notice>}
          </form>
        )
      )}
    </div>
  );
}

export function Checklist({ siteId, items }: { siteId: string; items: ChecklistItem[] }) {
  const [pending, start] = useTransition();
  const done = items.filter((i) => i.done).length;
  return (
    <section className="card border-sky-200 p-5" data-testid="checklist">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">New campaign checklist · {done}/{items.length}</h2>
        <button className="text-xs text-ink-soft underline" onClick={() => start(async () => { await hideChecklistAction(siteId); })}>Hide</button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">This website was copied. Private details of the original client were removed – work through these before launching.</p>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={i.done}
              disabled={!i.manual || pending}
              aria-label={i.label}
              onChange={(e) => start(async () => { await tickChecklistAction(siteId, i.id, e.target.checked); })}
              className="h-4 w-4 accent-brand"
            />
            <span className={i.done ? "text-ink-soft line-through" : ""}>{i.label}</span>
            {!i.manual && <span className="text-xs text-ink-faint">(ticks itself)</span>}
            <Link href={i.link} className="ml-auto text-brand underline">Open</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
