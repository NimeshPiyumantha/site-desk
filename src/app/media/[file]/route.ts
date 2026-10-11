import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/server/db";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

/**
 * Stands in for a picture this copy of the app does not have on disk.
 *
 * A serverless host gives each instance its own temporary disk, so the instance answering an
 * image request is often not the one that stored it. A broken image in the middle of a client's
 * website is a worse answer than a plain grey panel saying so, and it must not be cached: the
 * real file may well be there on the next request.
 */
function placeholder() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="Picture not available">`
    + `<rect width="640" height="360" fill="#eef1f5"/>`
    + `<rect x="0.5" y="0.5" width="639" height="359" fill="none" stroke="#d6dce5"/>`
    + `<g fill="none" stroke="#9aa6b6" stroke-width="7" stroke-linejoin="round">`
    + `<rect x="259" y="139" width="122" height="88" rx="7"/><path d="M259 203l29-26 25 22 22-20 46 40"/></g>`
    + `<circle cx="296" cy="166" r="9" fill="#9aa6b6"/>`
    + `<text x="320" y="268" text-anchor="middle" fill="#6b7787"`
    + ` font-family="system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="21">`
    + `Picture not available</text></svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "script-src 'none'",
    },
  });
}

/** Serves uploaded pictures. File names are random UUIDs and never change, so they cache forever. */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(file);
  const full = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(full)) return placeholder();
  const ext = name.split(".").pop() ?? "";
  return new Response(fs.readFileSync(full), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "script-src 'none'" } });
}
