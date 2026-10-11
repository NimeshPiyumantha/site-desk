import Link from "next/link";
import ExportActivity from "@/components/admin/ExportActivity";
import { dateTime, when } from "@/lib/format";
import { visibleClientIds } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { visibleSites } from "@/server/services";

const LABELS: Record<string, string> = {
  "launch.success": "Published", "launch.failed": "Launch failed", "draft.save": "Draft saved", "review.request": "Sent for review", "review.cancel": "Review withdrawn",
  "backup.create": "Backup", "backup.restore": "Restored backup", "site.copy": "New website", "settings.update": "Settings", "demo.simulate": "Demo", "transfer.export": "Transfer", "transfer.import": "Transfer", "team.add": "People", "team.access": "Access",
};

export default async function ActivityPage() {
  const u = await requireUser();
  const sites = await visibleSites(u.actor, u.workspaceId);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const releases = await repo.recentReleases(sites.map((s) => s.id), 25);
  const clientIds = visibleClientIds(u.actor, (await repo.listClients(u.workspaceId)).map((c) => c.id));
  const log = await repo.listAudit(clientIds, undefined, 80, u.actor.isAdmin);
  const byId = new Map(await Promise.all(log.map(async (a) => [a.id, await repo.userName(a.user_id)] as const)));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Launches</h1>
        <p className="text-sm text-ink-soft">Every attempt to put a website live – which website, what happened and what to do.</p>
        <ul className="card divide-y">
          {releases.map((r) => (
            <li key={r.id} className={`p-4 text-sm ${r.status === "failed" ? "bg-red-50" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                {r.status === "failed" ? <span className="pill bg-red-600 text-white">Failed</span> : <span className="pill bg-emerald-100 text-emerald-800">Version {r.number}{r.status === "live" ? " · live" : ""}</span>}
                <Link className="font-medium hover:underline" href={`/app/sites/${r.site_id}`}>{siteName.get(r.site_id)}</Link>
                <span className="ml-auto text-xs text-ink-soft" title={dateTime(r.created_at)}>{when(r.created_at)} · {r.authorName}</span>
              </div>
              <p className="mt-1">{r.summary}</p>
              {r.errorInfo && <p className="mt-1 text-red-900"><strong>What happened:</strong> {r.errorInfo.whatHappened} <strong>What to do:</strong> {r.errorInfo.whatToDo} <em>The live website kept working.</em></p>}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Who did what</h2>
          <ExportActivity />
        </div>
        <p className="text-sm text-ink-soft">For the clients you work on.</p>
        <ul className="card divide-y text-sm">
          {log.map((a) => (
            <li key={a.id} className="p-3">
              <span className="text-xs text-ink-soft" title={dateTime(a.at)}>{when(a.at)} · {byId.get(a.id)} · {LABELS[a.action] ?? a.action}{a.site_id && siteName.get(a.site_id) ? ` · ${siteName.get(a.site_id)}` : ""}</span>
              <br />
              {a.detail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
