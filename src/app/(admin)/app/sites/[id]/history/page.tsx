import RestoreButton from "@/components/admin/RestoreButton";
import { RetryLaunchButton } from "@/components/admin/SiteActions";
import { diffContent, summarizeChanges } from "@/lib/content/diff";
import { dateTime, when } from "@/lib/format";
import { languageName } from "@/lib/i18n/languages";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";

const SOURCE: Record<string, string> = { publish: "Published", restore: "Went back to an earlier version", bulk: "Bulk update", backup: "Restored from backup" };

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const site = (await repo.getSite(id))!;
  const releases = await repo.listReleases(id);
  const live = releases.find((r) => r.status === "live");
  const canRestore = can(u.actor, "site.restore", site.client_id);
  const drafts = await repo.listDraftRevisions(id, 15);
  const draftAuthors = new Map(await Promise.all(drafts.map(async (d) => [d.revision, await repo.userName(d.author_id)] as const)));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3 lg:col-span-2">
        <h2 className="font-semibold">Published versions</h2>
        <p className="text-sm text-ink-soft">Newest first. The version marked LIVE is what visitors see right now.</p>
        {releases.length === 0 && <p className="card p-5 text-sm text-ink-soft">Nothing has been published yet.</p>}
        {releases.map((r) => {
          const restoreChanges = live && r.status === "previous" ? summarizeChanges(diffContent(live.content, r.content), live.content, r.content) : [];
          return (
            <article key={r.id} className={`card p-4 ${r.status === "live" ? "border-emerald-300 ring-1 ring-emerald-200" : r.status === "failed" ? "border-red-200 bg-red-50/40" : ""}`} data-testid={`release-${r.number ?? "failed"}`}>
              <div className="flex flex-wrap items-center gap-2">
                {r.status === "live" && <span className="pill bg-emerald-600 text-white">LIVE NOW</span>}
                {r.status === "failed" && <span className="pill bg-red-600 text-white">FAILED – never went live</span>}
                <span className="font-semibold">{r.number ? `Version ${r.number}` : "Launch attempt"}</span>
                <span className="text-sm text-ink-soft">· {SOURCE[r.source] ?? r.source} by {r.authorName} · {dateTime(r.created_at)} ({when(r.created_at)})</span>
              </div>
              <p className="mt-2 text-sm">{r.summary}</p>
              {r.note && <p className="mt-1 text-sm italic text-ink-soft">“{r.note}”</p>}
              <p className="mt-1 text-xs text-ink-soft">Languages visible: {r.content.settings.languages.filter((l) => l.public).map((l) => languageName(l.id)).join(", ")}</p>
              {r.errorInfo && (
                <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                  <p><strong>What happened:</strong> {r.errorInfo.whatHappened}</p>
                  <p><strong>What to do:</strong> {r.errorInfo.whatToDo}</p>
                  {r === releases.find((x) => x.status === "failed") && (!live || r.created_at > live.created_at) && can(u.actor, "site.publish", site.client_id) && <div className="mt-2"><RetryLaunchButton siteId={id} releaseId={r.id} /></div>}
                </div>
              )}
              {r.changeList.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-brand">What changed ({r.changeList.length})</summary>
                  <ul className="mt-2 divide-y rounded-lg border">
                    {r.changeList.map((c) => (
                      <li key={c.id} className="p-2">
                        <span className="font-medium">{c.label}</span>
                        <br />
                        {c.kind === "field" ? <span className="text-ink-soft"><span className="line-through">{c.before}</span> → {c.after}</span> : <span className="text-ink-soft">{c.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {canRestore && live && r.status === "previous" && (
                <div className="mt-3"><RestoreButton siteId={id} releaseId={r.id} number={r.number!} liveNumber={live.number!} summary={r.summary} changes={restoreChanges} /></div>
              )}
            </article>
          );
        })}
      </section>
      <aside className="space-y-3">
        <h2 className="font-semibold">Draft saves</h2>
        <p className="text-sm text-ink-soft">Every save to the draft, with who made it. These are not live until published.</p>
        <ul className="card divide-y text-sm">
          {drafts.map((d) => (
            <li key={d.revision} className="p-3"><span className="text-ink-soft">Save {d.revision} · {draftAuthors.get(d.revision)} · {when(d.created_at)}</span><br />{d.summary}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
