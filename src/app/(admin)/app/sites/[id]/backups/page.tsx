import BackupsPanel from "@/components/admin/BackupsPanel";
import { dateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { backupRestorePreview } from "@/server/services";

export default async function BackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const site = repo.getSite(id)!;
  const backups = repo.listBackups(id).map((b) => {
    const p = backupRestorePreview(u.actor, id, b.id)!;
    return { id: b.id, label: b.label, kind: b.kind, when: dateTime(b.created_at), by: repo.userName(b.created_by), liveNumber: b.live_release_number, preview: { liveChanges: p.liveChanges, draftChanges: p.draftChanges, backupHasLive: p.backupHasLive, currentLiveNumber: p.liveNumber } };
  });
  return <BackupsPanel siteId={id} backups={backups} canBackup={can(u.actor, "site.backup", site.client_id)} canRestore={can(u.actor, "site.restore", site.client_id)} />;
}
