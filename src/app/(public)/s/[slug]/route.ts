import { NextResponse } from "next/server";
import { db } from "@/server/db";
import * as repo from "@/server/repo";

/** /s/<site> → the website's main language. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  db();
  const site = await repo.getSiteBySlug(slug);
  const live = site ? await repo.getLiveRelease(site) : null;
  if (!live) return new NextResponse("This website is not published.", { status: 404 });
  return NextResponse.redirect(new URL(`/s/${slug}/${live.content.settings.defaultLanguage}`, req.url), 307);
}
