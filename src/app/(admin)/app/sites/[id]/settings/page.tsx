import SettingsForm from "@/components/admin/SettingsForm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const site = repo.getSite(id)!;
  const { content } = repo.getDraft(id);
  const live = repo.getLiveRelease(site);
  return (
    <SettingsForm
      siteId={id}
      name={site.name}
      slug={site.slug}
      notes={site.notes}
      gaId={content.settings.gaId}
      gtmId={content.settings.gtmId}
      liveGa={live?.content.settings.gaId ?? ""}
      liveGtm={live?.content.settings.gtmId ?? ""}
      canSettings={can(u.actor, "site.settings", site.client_id)}
      canTransfer={can(u.actor, "site.transfer")}
      simulateFailure={Boolean(site.simulate_failure)}
      isLive={Boolean(live)}
    />
  );
}
