import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Public websites are crawlable; the team app, sign-in and private media are not.
 * The sitemap is advertised as an absolute URL (required by the robots.txt specification),
 * derived from the request host the same way `sitemap.ts` does it.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const base = process.env.SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  return {
    rules: [{ userAgent: "*", allow: "/s/", disallow: ["/app/", "/login", "/media/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
