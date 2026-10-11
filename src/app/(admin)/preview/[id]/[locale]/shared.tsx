import { notFound } from "next/navigation";
import SiteRenderer from "@/components/public/SiteRenderer";
import { languageName } from "@/lib/i18n/languages";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";

/** Private preview of the DRAFT. Requires sign-in, is never indexed, and shows missing translations. */
export async function Preview({ id, locale, page }: { id: string; locale: string; page: "home" | "about" }) {
  const u = await requireUser();
  const site = repo.getSite(id);
  if (!site || !can(u.actor, "site.view", site.client_id)) notFound();
  const { content, revision } = repo.getDraft(id);
  const langs = content.settings.languages;
  if (!langs.some((l) => l.id === locale)) notFound();
  const visible = langs.find((l) => l.id === locale)?.public;
  return (
    <div>
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-3 bg-amber-400 px-4 py-2 text-sm text-amber-950">
        <strong>PREVIEW – not public.</strong>
        <span>Draft of “{site.name}” (save {revision}) in {languageName(locale)}{visible ? "" : " – this language is hidden from visitors"}.</span>
        <span className="hidden sm:inline">Highlighted texts are missing translations.</span>
        <a href={`/app/sites/${id}`} className="ml-auto underline">Back to SiteDesk</a>
      </div>
      <SiteRenderer content={content} locale={locale} page={page} base={`/preview/${id}`} slug={site.slug} preview languages={langs.map((l) => l.id)} />
    </div>
  );
}
