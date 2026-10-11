import PublishPanel from "@/components/admin/PublishPanel";
import { validateForPublish } from "@/lib/content/validate";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { pendingChanges } from "@/server/services";

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const site = (await repo.getSite(id))!;
  const { changes, draft, live } = await pendingChanges(site);
  const liveRelease = await repo.getLiveRelease(site);
  return (
    <PublishPanel
      siteId={id}
      slug={site.slug}
      changes={changes}
      firstLaunch={!live}
      canPublish={can(u.actor, "site.publish", site.client_id)}
      canRequest={can(u.actor, "site.requestReview", site.client_id)}
      draftIssues={validateForPublish(draft)}
      liveNumber={liveRelease?.number ?? null}
      reviewState={site.review_state}
    />
  );
}
