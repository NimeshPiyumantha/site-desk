import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/server/db";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

/** Serves uploaded pictures. File names are random UUIDs and never change, so they cache forever. */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(file);
  const full = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop() ?? "";
  return new Response(fs.readFileSync(full), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "script-src 'none'" } });
}
