import LanguagesPanel from "@/components/admin/LanguagesPanel";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";

export default async function LanguagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const site = repo.getSite(id)!;
  const { content } = repo.getDraft(id);
  const live = repo.getLiveRelease(site);
  return <LanguagesPanel siteId={id} slug={site.slug} draft={content} liveLanguages={live?.content.settings.languages.filter((l) => l.public).map((l) => l.id) ?? []} canEdit={can(u.actor, "site.edit", site.client_id)} />;
}
