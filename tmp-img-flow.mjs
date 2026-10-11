/** Uploads a picture through the editor UI and checks it is really served back. */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE;
const fails = [];
const ok = (m, d = "") => console.log(`  PASS  ${m}${d ? " — " + d : ""}`);
const bad = (m, d = "") => { console.log(`  FAIL  ${m}${d ? " — " + d : ""}`); fails.push(m); };

// A 2x2 red PNG.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000002000000020806000000" +
  "72b60d240000001849444154789c63fccfc0f09f81e13f0306c40100b5" +
  "0b0b01d7a1a1e40000000049454e44ae426082", "hex");

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const ctx = await b.newContext();
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error" && !/chrome-extension/.test(m.text())) errs.push(m.text()); });

await p.goto(BASE + "/login", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Amara Perera/ }).click();
await p.waitForURL(/\/app/, { timeout: 60000 });
ok("signed in");

await p.goto(BASE + "/app/sites/site_galle/edit", { waitUntil: "networkidle" });
const input = p.locator('input[type="file"]').first();
if (!(await input.count())) { bad("no file input on the editor page"); }
else {
  await input.setInputFiles({ name: "test-upload.png", mimeType: "image/png", buffer: PNG });
  await p.waitForTimeout(9000);
  ok("file submitted through the editor");

  // Find a /media/ reference the page now holds.
  const html = await p.content();
  const match = html.match(/\/media\/[A-Za-z0-9-]+\.(?:png|jpg|jpeg|webp|gif|svg)/);
  if (!match) bad("no /media/ reference appeared after upload");
  else {
    const url = match[0];
    ok("editor references the upload", url);
    const r = await p.request.get(BASE + url);
    const ct = r.headers()["content-type"] ?? "";
    const body = await r.body();
    r.status() === 200 ? ok("picture is served", `status 200, ${body.byteLength} bytes, ${ct}`) : bad("picture not served", "status " + r.status());
    /^image\/(png|jpeg|webp|gif)/.test(ct) ? ok("served as a real image, not the placeholder") : bad("served as", ct);
    // The placeholder is an SVG panel; a real upload must not come back as one.
    !/svg/.test(ct) ? ok("not the 'Picture not available' panel") : bad("got the placeholder instead");

    // Served consistently, which is the part that failed before.
    let good = 0;
    for (let i = 0; i < 6; i++) {
      const rr = await p.request.get(BASE + url);
      if (rr.status() === 200 && /^image\/(png|jpeg|webp|gif)/.test(rr.headers()["content-type"] ?? "")) good++;
    }
    good === 6 ? ok("served on every request", `${good}/6`) : bad("inconsistent", `${good}/6`);
  }
}

// A picture that was never uploaded still degrades to the placeholder.
const miss = await p.request.get(BASE + "/media/00000000-0000-4000-8000-000000000000.png");
miss.status() === 200 && /svg/.test(miss.headers()["content-type"] ?? "")
  ? ok("missing picture still shows the placeholder") : bad("missing picture", `status ${miss.status()}`);

errs.length === 0 ? ok("no console errors") : bad("console errors", JSON.stringify(errs.slice(0, 2)));
await b.close();
console.log(fails.length ? `\nFAILURES: ${fails.length}` : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
