import { NextResponse } from "next/server";
import { db } from "@/server/db";
import * as repo from "@/server/repo";

export const dynamic = "force-dynamic";

/** A colour we are willing to put in the SVG: #rgb, #rrggbb or #rrggbbaa, nothing else. */
const SAFE_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * /s/<site>/icon → the website's favicon, in that website's own brand colour.
 *
 * Public pages are the client's campaign website, so they get their own mark rather than
 * SiteDesk's. Both values come from editable content, so neither is trusted: the initial is a
 * single letter or digit and the colour has to match SAFE_COLOR, which leaves no way for brand
 * text to reach the SVG as markup.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  db();
  const site = repo.getSiteBySlug(slug);
  const live = site ? repo.getLiveRelease(site) : null;
  if (!live) return new NextResponse("This website is not published.", { status: 404 });

  const brand = live.content.brand;
  const initial = (brand.name.match(/[A-Za-z0-9]/)?.[0] ?? "S").toUpperCase();
  const fill = SAFE_COLOR.test(brand.primaryColor.trim()) ? brand.primaryColor.trim() : "#334155";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="${initial}">`
    + `<rect width="32" height="32" rx="7" fill="${fill}"/>`
    + `<text x="16" y="16.5" text-anchor="middle" dominant-baseline="central"`
    + ` font-family="system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"`
    + ` font-size="19" font-weight="700" fill="#ffffff">${initial}</text>`
    + `</svg>`;

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // The icon follows the published brand, so it must not outlive a publish.
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
