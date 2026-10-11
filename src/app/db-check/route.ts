/**
 * TEMPORARY diagnostic. Reports why the database connection fails on a host whose logs are not
 * to hand. Returns only the error's name, message and code, with any connection string redacted.
 * Delete once the cause is known.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const redact = (s: string) => s.replace(/postgres(ql)?:\/\/[^\s"']+/gi, "postgresql://<redacted>");

export async function GET() {
  const out: Record<string, unknown> = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    urlHost: process.env.DATABASE_URL ? (() => { try { return new URL(process.env.DATABASE_URL!).host; } catch { return "unparseable"; } })() : null,
    hasSitedeskSecret: Boolean(process.env.SITEDESK_SECRET),
    vercel: Boolean(process.env.VERCEL),
    runtime: process.version,
  };

  try {
    const { db } = await import("@/server/db");
    const driver = await db();
    out.dialect = driver.dialect;
    const row = await driver.get<{ n: number }>("SELECT COUNT(*) n FROM users");
    out.userCount = row?.n ?? null;
    out.ok = true;
  } catch (e) {
    const err = e as Error & { code?: string; severity?: string };
    out.ok = false;
    out.errorName = err.name;
    out.errorCode = err.code ?? null;
    out.errorMessage = redact(String(err.message ?? err));
    out.stackTop = redact(String(err.stack ?? "")).split("\n").slice(0, 4).join(" | ");
  }

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
