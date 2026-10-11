import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SiteRenderer from "@/components/public/SiteRenderer";
import { getPublicPage } from "@/server/public-data";

async function origin() {
  const h = await headers();
  return process.env.SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

export async function publicMetadata(slug: string, locale: string, page: "home" | "about"): Promise<Metadata> {
  const data = await getPublicPage(slug, locale);
  // The website's own mark, served by /s/<slug>/icon – not SiteDesk's.
  const icons = { icon: [{ url: `/s/${slug}/icon`, type: "image/svg+xml" }] };
  if (!data?.localeOk) return { title: "Not found", icons, robots: { index: false } };
  const c = data.content;
  const suffix = page === "about" ? "/about" : "";
  const base = await origin();
  const title = page === "about" ? `${c.about.title[locale]} – ${c.brand.name}` : c.seo.title[locale];
  return {
    metadataBase: new URL(base),
    title,
    icons,
    description: page === "about" ? c.about.intro[locale] : c.seo.description[locale],
    alternates: {
      canonical: `/s/${slug}/${locale}${suffix}`,
      languages: Object.fromEntries([...data.languages.map((l) => [l, `/s/${slug}/${l}${suffix}`]), ["x-default", `/s/${slug}/${c.settings.defaultLanguage}${suffix}`]]),
    },
    openGraph: { title, description: c.seo.description[locale], images: [c.hero.image], locale, type: "website" },
    robots: { index: true, follow: true },
  };
}

export async function PublicPage({ slug, locale, page }: { slug: string; locale: string; page: "home" | "about" }) {
  const data = await getPublicPage(slug, locale);
  if (!data?.localeOk) notFound();
  return <SiteRenderer content={data.content} locale={locale} page={page} base={`/s/${slug}`} slug={slug} languages={data.languages} />;
}
