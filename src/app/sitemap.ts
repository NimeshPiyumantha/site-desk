import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { db } from "@/server/db";
import * as repo from "@/server/repo";

export const dynamic = "force-dynamic";

/** Every public page of every live website, in every visible language. Private languages are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  db();
  const h = await headers();
  const base = process.env.SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const out: MetadataRoute.Sitemap = [];
  for (const site of repo.listAllLiveSites()) {
    const live = repo.getLiveRelease(site);
    if (!live) continue;
    const langs = live.content.settings.languages.filter((l) => l.public).map((l) => l.id);
    for (const page of ["", "/about"]) {
      for (const l of langs) {
        out.push({
          url: `${base}/s/${site.slug}/${l}${page}`,
          lastModified: live.created_at,
          alternates: { languages: Object.fromEntries(langs.map((x) => [x, `${base}/s/${site.slug}/${x}${page}`])) },
        });
      }
    }
  }
  return out;
}
