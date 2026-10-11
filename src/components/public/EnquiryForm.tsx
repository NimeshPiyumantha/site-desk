"use client";
import { useState } from "react";
import { submitLeadAction } from "@/server/actions";

export default function EnquiryForm(props: { slug: string; locale: string; preview: boolean; labels: { name: string; email: string; message: string; submit: string; thanks: string } }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const { labels } = props;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (props.preview) {
      setError("This is a preview – enquiries are not sent from here.");
      setState("error");
      return;
    }
    const f = new FormData(e.currentTarget);
    setState("sending");
    const res = await submitLeadAction(props.slug, { name: String(f.get("name")), email: String(f.get("email")), message: String(f.get("message")), website: String(f.get("website") ?? ""), locale: props.locale });
    if (res.ok) setState("sent");
    else {
      setError(res.error ?? "Please try again.");
      setState("error");
    }
  }

  const field = "mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[var(--ink)] outline-none transition-shadow focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15";

  if (state === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--accent)] p-7 text-lg" role="status">
        <span aria-hidden className="mt-0.5">✓</span>
        <p>{labels.thanks}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-[0_1px_2px_rgb(22_33_44/0.04)]">
      <label className="block text-sm font-medium">
        {labels.name}
        <input name="name" required className={field} />
      </label>
      <label className="block text-sm font-medium">
        {labels.email}
        <input name="email" type="email" required className={field} />
      </label>
      <label className="block text-sm font-medium">
        {labels.message}
        <textarea name="message" required rows={4} className={field} />
      </label>
      {/* Honeypot: bots fill hidden fields, people do not. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state === "error" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
      <button
        disabled={state === "sending"}
        className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
      >
        {state === "sending" ? "…" : labels.submit}
      </button>
    </form>
  );
}
