import Link from "next/link";
import { notFound } from "next/navigation";
import SiteTabs from "@/components/admin/SiteTabs";
import { languageName } from "@/lib/i18n/languages";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { pendingChanges } from "@/server/services";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const site = repo.getSite(id);
  if (!site || !can(u.actor, "site.view", site.client_id)) notFound();
  const client = repo.getClient(site.client_id)!;
  const { changes, draft } = pendingChanges(site);
  const live = repo.getLiveRelease(site);
  const role = u.actor.isAdmin ? "Operations admin" : u.actor.roles[site.client_id] === "publisher" ? "Reviewer / publisher" : "Content editor";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app" className="text-xs text-ink-soft hover:underline">← All websites · {client.name}</Link>
          <h1 className="page-title">{site.name}</h1>
          {/* "an Operations admin", but "a Content editor" – pick the article from the word. */}
          <p className="text-xs text-ink-soft">You are {/^[aeiou]/i.test(role) ? "an" : "a"} <strong>{role}</strong> for this client.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <details className="relative">
            <summary className="btn-secondary cursor-pointer list-none">👁 Preview draft ▾</summary>
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border bg-white p-1 shadow-lg">
              {draft.settings.languages.map((l) => (
                <a key={l.id} href={`/preview/${site.id}/${l.id}`} target="_blank" className="block rounded px-3 py-2 text-sm hover:bg-gray-50">
                  {languageName(l.id)} {l.public ? "" : <span className="text-xs text-ink-soft">(hidden)</span>}
                </a>
              ))}
            </div>
          </details>
          {live ? <a className="btn-secondary" href={`/s/${site.slug}`} target="_blank">↗ Live website</a> : <span className="btn-secondary cursor-default opacity-60">Not live yet</span>}
        </div>
      </div>
      <SiteTabs siteId={site.id} pendingCount={changes.length} />
      <div>{children}</div>
    </div>
  );
}
