import Link from "next/link";
import CopySiteButton from "@/components/admin/CopySiteButton";
import { PRIVATE_ITEMS } from "@/lib/clone";
import { when } from "@/lib/format";
import { languageName } from "@/lib/i18n/languages";
import { can, visibleClientIds } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { siteSummary } from "@/server/services";

export default async function Dashboard() {
  const u = await requireUser();
  const clients = repo.listClients(u.workspaceId).filter((c) => visibleClientIds(u.actor, [c.id]).length);
  const createClients = clients.filter((c) => can(u.actor, "site.create", c.id)).map((c) => ({ id: c.id, name: c.name }));
  const summaries = repo.listSitesForClients(clients.map((c) => c.id)).map((s) => siteSummary(u.actor, s));
  const failed = summaries.filter((s) => s.failedAfterLive);
  const reviews = summaries.filter((s) => s.site.review_state === "ready" && s.canPublish);
  const checklists = summaries.filter((s) => s.site.show_checklist && !s.liveRelease);
  const workspace = repo.getWorkspace(u.workspaceId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Websites</h1>
          <p className="text-sm text-ink-soft">{workspace?.name} · {summaries.length} website{summaries.length === 1 ? "" : "s"} for {clients.length} client{clients.length === 1 ? "" : "s"}</p>
        </div>
        <Link href="/app/bulk" className="btn-primary">Update several websites →</Link>
      </div>

      {(failed.length > 0 || reviews.length > 0 || checklists.length > 0) && (
        <section className="card p-5">
          <h2 className="font-semibold">Needs your attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {failed.map((s) => (
              <li key={`f-${s.site.id}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-red-900">
                <span className="pill bg-red-600 text-white">Launch failed</span>
                <strong>{s.site.name}</strong> – {s.failedAfterLive!.errorInfo?.whatHappened} {s.liveRelease ? `Visitors still see version ${s.liveRelease.number}.` : "The website is not live yet."}
                <Link className="ml-auto underline" href={`/app/sites/${s.site.id}`}>What to do →</Link>
              </li>
            ))}
            {reviews.map((s) => (
              <li key={`r-${s.site.id}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-900">
                <span className="pill bg-amber-500 text-white">Waiting for review</span>
                <strong>{s.site.name}</strong> – {repo.userName(s.site.review_requested_by)} sent {s.changes.length} change{s.changes.length === 1 ? "" : "s"}{s.site.review_note ? `: “${s.site.review_note}”` : ""}
                <Link className="ml-auto underline" href={`/app/sites/${s.site.id}/publish`}>Review →</Link>
              </li>
            ))}
            {checklists.map((s) => (
              <li key={`c-${s.site.id}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 p-3 text-sky-900">
                <span className="pill bg-sky-600 text-white">New campaign</span>
                <strong>{s.site.name}</strong> – finish the setup checklist before launching.
                <Link className="ml-auto underline" href={`/app/sites/${s.site.id}`}>Continue →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {clients.map((client) => {
        const sites = summaries.filter((s) => s.site.client_id === client.id);
        return (
          <section key={client.id}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">{client.name}</h2>
            {sites.length === 0 && <p className="card p-5 text-sm text-ink-soft">No websites yet. Copy an existing website to start a campaign for this client.</p>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sites.map((s) => {
                const langs = s.draft.settings.languages;
                return (
                  <article key={s.site.id} className="card flex flex-col p-5" data-testid={`site-card-${s.site.slug}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/app/sites/${s.site.id}`} className="font-semibold hover:underline">{s.site.name}</Link>
                      {s.failedAfterLive ? <span className="pill bg-red-100 text-red-800">Launch failed</span> : s.liveRelease ? <span className="pill bg-emerald-100 text-emerald-800">Live · v{s.liveRelease.number}</span> : <span className="pill bg-gray-100 text-ink-soft">Not launched</span>}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">/s/{s.site.slug}{s.liveRelease ? ` · updated ${when(s.liveRelease.created_at)}` : ""}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {langs.map((l) => {
                        const isLive = s.live?.settings.languages.some((x) => x.id === l.id && x.public);
                        return <span key={l.id} className={`pill ${isLive ? "bg-brand-light text-brand" : "bg-gray-100 text-ink-soft"}`} title={isLive ? "Visible to visitors" : "Hidden from visitors"}>{languageName(l.id)}{isLive ? "" : " (hidden)"}</span>;
                      })}
                    </div>
                    <div className="mt-3 text-sm">
                      {s.site.review_state === "ready" ? <span className="text-amber-700">● Waiting for review</span> : s.changes.length > 0 ? <span className="text-ink-soft">● {s.changes.length} unpublished change{s.changes.length === 1 ? "" : "s"}</span> : s.liveRelease ? <span className="text-emerald-700">● Everything published</span> : <span className="text-ink-soft">● Draft – not public yet</span>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 pt-2">
                      <Link href={`/app/sites/${s.site.id}`} className="btn-primary py-1.5">Open</Link>
                      <CopySiteButton className="btn-secondary py-1.5" siteId={s.site.id} siteName={s.site.name} defaultClientId={client.id} clients={createClients} isAdmin={u.actor.isAdmin} privateItems={PRIVATE_ITEMS} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      {clients.length === 0 && <p className="card p-6 text-sm text-ink-soft">You don’t have access to any clients in this workspace yet. Ask an operations admin to add you.</p>}
    </div>
  );
}
