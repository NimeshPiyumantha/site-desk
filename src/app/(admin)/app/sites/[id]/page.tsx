import Link from "next/link";
import CopySiteButton from "@/components/admin/CopySiteButton";
import { Checklist, RetryLaunchButton, ReviewBox } from "@/components/admin/SiteActions";
import { Notice } from "@/components/admin/ui";
import { PRIVATE_ITEMS } from "@/lib/clone";
import { dateTime, when } from "@/lib/format";
import { formatLanguageList } from "@/lib/i18n/languages";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { checklistFor, siteSummary } from "@/server/services";

export default async function Overview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string; launched?: string }> }) {
  const { id } = await params;
  const { copied, launched } = await searchParams;
  const u = await requireUser();
  const s = siteSummary(u.actor, repo.getSite(id)!);
  const { site, liveRelease, failedAfterLive, changes } = s;
  const clients = repo.listClients(u.workspaceId).filter((c) => can(u.actor, "site.create", c.id)).map((c) => ({ id: c.id, name: c.name }));
  const activity = repo.listAudit([site.client_id], site.id, 8);
  const leads = can(u.actor, "leads.view", site.client_id) ? repo.listLeads(site.id) : null;
  const source = site.copied_from ? repo.getSite(site.copied_from) : null;
  const liveLangs = liveRelease?.content.settings.languages.filter((l) => l.public).map((l) => l.id) ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {copied && <Notice tone="success" title="New website created">It is a private draft – visitors cannot see it yet. {source ? `“${source.name}” was not changed.` : ""}</Notice>}
        {launched && !failedAfterLive && <Notice tone="success" title="Launched successfully">Version {launched} is live – visitors see the new content now.</Notice>}
        {failedAfterLive && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" data-testid="failed-launch">
            <p className="text-sm font-semibold uppercase tracking-wide">Launch failed · {when(failedAfterLive.created_at)} by {failedAfterLive.authorName}</p>
            <p className="mt-2"><strong>What happened:</strong> {failedAfterLive.errorInfo?.whatHappened} <span className="text-red-700">(step: {failedAfterLive.errorInfo?.step})</span></p>
            <p className="mt-1"><strong>Visitors see:</strong> {liveRelease ? `the previous version (version ${liveRelease.number}) – the live website is working.` : "nothing yet – this website was not live before."}</p>
            <p className="mt-1"><strong>What to do:</strong> {failedAfterLive.errorInfo?.whatToDo}</p>
            {can(u.actor, "site.publish", site.client_id) && <div className="mt-3"><RetryLaunchButton siteId={site.id} releaseId={failedAfterLive.id} /></div>}
          </section>
        )}
        {site.show_checklist ? <Checklist siteId={site.id} items={checklistFor(site, s.draft)} /> : null}

        <section className="card p-5">
          <h2 className="font-semibold">Live website</h2>
          {liveRelease ? (
            <div className="mt-2 text-sm">
              <p>
                <span className="pill bg-emerald-100 text-emerald-800">LIVE · version {liveRelease.number}</span> published {dateTime(liveRelease.created_at)} by {liveRelease.authorName}
              </p>
              <p className="mt-2 text-ink-soft">“{liveRelease.summary}”</p>
              <p className="mt-2">Visible in {formatLanguageList(liveLangs)} at <a className="text-brand underline" href={`/s/${site.slug}`} target="_blank">/s/{site.slug}</a></p>
              <Link href={`/app/sites/${site.id}/history`} className="mt-3 inline-block text-brand underline">See history or go back to an earlier version →</Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Not launched yet. When the content is ready, open “Review & publish”.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Unpublished changes</h2>
          <div className="mt-3">
            {liveRelease ? (
              <ReviewBox siteId={site.id} state={site.review_state} requestedBy={repo.userName(site.review_requested_by)} note={site.review_note} pendingCount={changes.length} canPublish={can(u.actor, "site.publish", site.client_id)} canRequest={can(u.actor, "site.requestReview", site.client_id)} />
            ) : (
              <ReviewBox siteId={site.id} state={site.review_state} requestedBy={repo.userName(site.review_requested_by)} note={site.review_note} pendingCount={1} firstLaunch canPublish={can(u.actor, "site.publish", site.client_id)} canRequest={can(u.actor, "site.requestReview", site.client_id)} />
            )}
          </div>
          {changes.length > 0 && (
            <ul className="mt-4 divide-y text-sm">
              {changes.slice(0, 6).map((c) => (
                <li key={c.id} className="py-2"><span className="font-medium">{c.label}</span><br /><span className="text-ink-soft">{c.detail}</span></li>
              ))}
              {changes.length > 6 && <li className="py-2 text-ink-soft">…and {changes.length - 6} more</li>}
            </ul>
          )}
        </section>

        {leads && (
          <section className="card p-5">
            <h2 className="font-semibold">Enquiries from visitors <span className="text-xs font-normal text-ink-soft">(private to this client – never copied or exported)</span></h2>
            {leads.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No enquiries yet.</p> : (
              <ul className="mt-2 divide-y text-sm">
                {leads.map((l) => <li key={l.id} className="py-2"><strong>{l.name}</strong> · {l.email} · {when(l.created_at)}<br /><span className="text-ink-soft">{l.message}</span></li>)}
              </ul>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-6">
        <section className="card p-5">
          <h2 className="font-semibold">Quick actions</h2>
          <div className="mt-3 flex flex-col gap-2">
            {can(u.actor, "site.edit", site.client_id) && <Link className="btn-primary" href={`/app/sites/${site.id}/edit`}>Edit content</Link>}
            <Link className="btn-secondary" href={`/app/sites/${site.id}/languages`}>Languages & translations</Link>
            <CopySiteButton siteId={site.id} siteName={site.name} defaultClientId={site.client_id} clients={clients} isAdmin={u.actor.isAdmin} privateItems={PRIVATE_ITEMS} />
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Recent activity</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {activity.map((a) => (
              <li key={a.id}><span className="text-ink-soft">{when(a.at)} · {repo.userName(a.user_id)}</span><br />{a.detail}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
