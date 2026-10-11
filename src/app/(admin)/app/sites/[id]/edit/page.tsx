import Editor from "@/components/admin/Editor";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string; lang?: string }> }) {
  const { id } = await params;
  const { section, lang } = await searchParams;
  const u = await requireUser();
  const site = repo.getSite(id)!;
  const { content, revision } = repo.getDraft(id);
  return <Editor siteId={id} initial={content} revision={revision} canEdit={can(u.actor, "site.edit", site.client_id)} initialSection={section} initialLocale={lang} />;
}
