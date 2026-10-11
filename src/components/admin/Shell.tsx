"use client";
/**
 * The frame around every team screen: navigation, workspace switcher, who is signed in, help.
 *
 * The navigation is a sidebar on a laptop and a scrolling bar on a phone. Each link is rendered
 * exactly ONCE and only repositioned with CSS — rendering a second copy for small screens would
 * give every link a hidden twin, which confuses both screen readers and tests.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { helpFor, screenFromPath } from "@/lib/help";
import { logoutAction, switchWorkspaceAction } from "@/server/actions";

const ICONS: Record<string, string> = {
  "/app": "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  "/app/bulk": "M4 7h16M4 12h16M4 17h9",
  "/app/search": "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5.5-1.5L21 21",
  "/app/activity": "M3 12h4l3 8 4-16 3 8h4",
  "/app/transfer": "M4 8h12l-3-3m3 11H4l3 3",
  "/app/team": "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 8v-1.5a3.5 3.5 0 0 0-2.6-3.4M15 4.1a3.5 3.5 0 0 1 0 6.8",
};

export default function Shell(props: {
  children: React.ReactNode;
  userName: string;
  userTitle: string;
  isAdmin: boolean;
  workspaceId: string;
  workspaces: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, start] = useTransition();

  const nav = [
    { href: "/app", label: "Websites", active: pathname === "/app" || pathname.startsWith("/app/sites") },
    { href: "/app/bulk", label: "Update several websites", active: pathname.startsWith("/app/bulk") },
    { href: "/app/search", label: "Find text", active: pathname.startsWith("/app/search") },
    { href: "/app/activity", label: "Activity", active: pathname.startsWith("/app/activity") },
    ...(props.isAdmin
      ? [
          { href: "/app/transfer", label: "Transfer", active: pathname.startsWith("/app/transfer") },
          { href: "/app/team", label: "People", active: pathname.startsWith("/app/team") },
        ]
      : []),
  ];
  const articles = helpFor(screenFromPath(pathname));

  return (
    <div className="min-h-screen bg-surface-sunken md:grid md:grid-cols-[16rem_1fr]">
      {/* Sidebar on md+, a bar across the top on a phone. */}
      {/* The grid stretches this column, so the white surface runs the full page height. */}
      <div className="sticky top-0 z-40 border-b border-surface-line bg-white md:static md:z-auto md:border-b-0 md:border-r">
        <div className="md:sticky md:top-0 md:max-h-screen md:overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3.5 md:px-5">
          <Link href="/app" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-white shadow-sm">S</span>
            SiteDesk
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3" aria-label="Sections">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`nav-link whitespace-nowrap ${n.active ? "nav-link-active" : ""}`} aria-current={n.active ? "page" : undefined}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <path d={ICONS[n.href]} />
              </svg>
              {n.label}
            </Link>
          ))}
        </nav>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="z-30 border-b border-surface-line bg-white/90 backdrop-blur md:sticky md:top-0">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 md:px-8">
            {/* Rendered once, for every screen size – see the note at the top of this file. */}
            {props.workspaces.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="hidden sm:inline">Workspace</span>
                <select
                  className="input w-auto py-1.5 text-xs"
                  value={props.workspaceId}
                  disabled={pending}
                  onChange={(e) => start(() => switchWorkspaceAction(e.target.value))}
                  aria-label="Workspace"
                >
                  {props.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button className="btn-secondary py-1.5" onClick={() => setHelpOpen(true)} aria-haspopup="dialog">
                <span aria-hidden>?</span> Help
              </button>
              <div className="flex items-center gap-2.5 border-l border-surface-line pl-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light text-xs font-semibold text-brand-dark" aria-hidden>
                  {props.userName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <span className="hidden text-xs leading-tight sm:block">
                  <span className="block font-medium text-ink">{props.userName}</span>
                  <span className="block text-ink-soft">{props.userTitle}</span>
                </span>
                <form action={logoutAction}>
                  <button className="text-xs text-ink-soft underline underline-offset-2 hover:text-ink">Sign out</button>
                </form>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 md:px-8">{props.children}</main>
      </div>

      {helpOpen && (
        <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" onClick={() => setHelpOpen(false)}>
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Help"
          >
            <div className="flex items-center justify-between border-b border-surface-line px-6 py-4">
              <h2>Help for this page</h2>
              <button onClick={() => setHelpOpen(false)} aria-label="Close help" className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-sunken">✕</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {articles.map((a, i) => (
                <details key={a.id} open={i === 0} className="group rounded-xl border border-surface-line bg-white p-4 open:bg-surface-sunken/40">
                  <summary className="cursor-pointer list-none font-medium marker:content-none">
                    <span className="mr-2 inline-block text-ink-faint transition-transform group-open:rotate-90" aria-hidden>›</span>
                    {a.title}
                  </summary>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-relaxed text-ink-soft">
                    {a.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                  {a.note && <p className="mt-3 rounded-lg bg-brand-light px-3 py-2 text-xs leading-relaxed text-brand-dark">{a.note}</p>}
                </details>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
