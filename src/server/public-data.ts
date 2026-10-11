import * as repo from "./repo";

/** The live content of a public website, or null if it is not live (or that language is private). */
export async function getPublicPage(slug: string, locale: string) {
  const site = await repo.getSiteBySlug(slug);
  if (!site) return null;
  const live = await repo.getLiveRelease(site);
  if (!live) return null;
  const languages = live.content.settings.languages.filter((l) => l.public).map((l) => l.id);
  if (!languages.includes(locale)) return { site, content: live.content, languages, localeOk: false as const };
  return { site, content: live.content, languages, localeOk: true as const };
}
