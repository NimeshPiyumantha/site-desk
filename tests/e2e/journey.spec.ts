import { expect, test, type Browser, type Page } from "@playwright/test";
import path from "node:path";

const DEMO = path.join(process.cwd(), "demo-files");

async function login(page: Page, name: RegExp) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("button", { name }).click();
  await page.waitForURL("**/app");
}

async function newUser(browser: Browser, name: RegExp) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, name);
  return page;
}

/** Sign in with email + password – used for people created during the demo, who have no quick-login button. */
async function loginWith(browser: Browser, email: string, password: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
  return page;
}

test.describe.serial("connected journey", () => {
  let siteUrl = "";

  test("1. new campaign: copy an existing website without private client information", async ({ page }) => {
    await login(page, /Amara Perera/);
    await page.getByTestId("site-card-hill-country-tea-tours").getByRole("button", { name: /Copy for new campaign/ }).click();
    await page.getByLabel("Name of the new website").fill("Misty Mountain Retreats");
    await expect(page.getByLabel("Web address")).toHaveValue("misty-mountain-retreats");
    await page.getByLabel("Client").selectOption("__new");
    await page.getByLabel("New client name").fill("Misty Mountain Hotels");
    await page.getByRole("button", { name: "Create copy" }).click();
    await page.waitForURL(/\/app\/sites\/site_.*copied=1/);
    siteUrl = page.url().split("?")[0];
    await expect(page.getByText("New website created")).toBeVisible();
    await expect(page.getByTestId("checklist")).toBeVisible();

    // Private details were not copied.
    await page.goto(`${siteUrl}/edit?section=contact`);
    await expect(page.locator('[id="f-contact.email"]')).toHaveValue("");
    await expect(page.locator('[id="f-contact.phone"]')).toHaveValue("");

    // Adapt: contact details, headline, offer price.
    await page.locator('[id="f-contact.email"]').fill("stay@mistymountain.example");
    await page.locator('[id="f-contact.phone"]').fill("+94 52 555 0101");
    await page.getByRole("button", { name: "Top banner" }).click();
    await page.locator('[id="f-hero.title.en"]').fill("Misty mornings, warm welcomes.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved to the draft/)).toBeVisible();
  });

  test("2. add Tamil and Sinhala from the client's translation files", async ({ page }) => {
    await login(page, /Amara Perera/);
    await page.goto(`${siteUrl}/languages`);
    for (const code of ["ta", "si"]) {
      await page.getByLabel("Language to add").selectOption(code);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByTestId(`lang-${code}`)).toBeVisible();
    }
    await page.getByLabel("Translation file").setInputFiles(path.join(DEMO, "tamil-translations.csv"));
    await expect(page.getByTestId("import-preview")).toContainText("Tamil after import: complete");
    await page.getByRole("button", { name: "Use these translations" }).click();
    await expect(page.getByText(/translations saved to the draft/)).toBeVisible();

    await page.getByLabel("Translation file").setInputFiles(path.join(DEMO, "sinhala-translations-incomplete.csv"));
    await expect(page.getByTestId("import-preview")).toContainText(/Sinhala after import: \d+ texts still missing/);
    await page.getByRole("button", { name: "Use these translations" }).click();
    await expect(page.getByText(/translations saved to the draft/)).toBeVisible();

    // Sinhala is incomplete, so it cannot be made visible; Tamil can.
    await expect(page.getByTestId("lang-si").getByRole("button", { name: "Make visible" })).toBeDisabled();
    await page.getByTestId("lang-ta").getByRole("button", { name: "Make visible" }).click();
    await expect(page.getByText(/Tamil is ready/)).toBeVisible();
  });

  test("3. preview and launch – unfinished Sinhala stays private", async ({ page, request }) => {
    await login(page, /Amara Perera/);
    const id = siteUrl.split("/").pop();
    await page.goto(`/preview/${id}/si`);
    await expect(page.getByText("PREVIEW – not public.")).toBeVisible();

    await page.goto(`${siteUrl}/publish`);
    await page.getByRole("button", { name: "Launch website" }).click();
    await expect(page.getByText(/Version 1 is live/)).toBeVisible();

    const ta = await request.get("/s/misty-mountain-retreats/ta");
    expect(ta.status()).toBe(200);
    const html = await ta.text();
    expect(html).toContain('lang="ta"');
    expect(html).toContain("மேகங்களுக்கு மேலே"); // Tamil hero from the client file
    expect(html).not.toContain("hillcountrytea.example"); // no data from the original client
    expect((await request.get("/s/misty-mountain-retreats/si")).status()).toBe(404);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/s/misty-mountain-retreats/ta");
    expect(sitemap).not.toContain("/s/misty-mountain-retreats/si");
    // The original website is untouched.
    expect(await (await request.get("/s/hill-country-tea-tours/en")).text()).toContain("hello@hillcountrytea.example");
  });

  test("4. update an offer price on 4 of 6 websites, English and Tamil only", async ({ page, request }) => {
    await login(page, /Amara Perera/);
    await page.goto("/app/bulk");
    await page.getByLabel("Offer", { exact: true }).selectOption("FAM-BEACH");
    await page.getByRole("button", { name: "Next: choose websites" }).click();
    for (const name of ["Colombo", "Galle", "Kandy", "Jaffna"]) await page.getByLabel(new RegExp(`Summer Escape – ${name}`)).check();
    await page.getByLabel("English", { exact: true }).check();
    await page.getByLabel("Tamil", { exact: true }).check();
    await page.getByRole("button", { name: "Next: new value" }).click();
    await page.getByLabel("New price in English").fill("LKR 39,900 per family");
    await page.getByLabel("New price in Tamil").fill("ஒரு குடும்பத்திற்கு ரூ. 39,900");
    await page.getByRole("button", { name: /check exactly what will change/ }).click();
    const preview = page.getByTestId("bulk-preview");
    await expect(preview).toContainText("8 values will change on 4 websites");
    await expect(preview).toContainText("Summer Escape – Trincomalee – not selected");
    await expect(preview).toContainText("Summer Escape – Galle – Sinhala stays");
    await page.getByLabel(/Publish these changes now/).check();
    await page.getByRole("button", { name: "Publish 8 changes" }).click();
    await expect(page.getByTestId("bulk-results")).toContainText("Live now as version 4");

    const galleEn = await (await request.get("/s/summer-escape-galle/en")).text();
    expect(galleEn).toContain("LKR 39,900 per family");
    expect(galleEn).toContain("2 nights in a boutique villa with dinner by the pool."); // pending draft edit NOT published
    expect(await (await request.get("/s/summer-escape-galle/si")).text()).toContain("පවුලකට රු. 45,000");
    expect(await (await request.get("/s/summer-escape-trincomalee/en")).text()).toContain("LKR 45,000 per family");
  });

  test("5. investigate the wrong offer and go back to the earlier version", async ({ page, request }) => {
    await login(page, /Priya Raj/);
    await page.goto("/app/sites/site_galle/history");
    await expect(page.getByTestId("release-4")).toContainText("LIVE NOW");
    await expect(page.getByTestId("release-4")).toContainText("Bulk update");
    await page.getByTestId("release-3").getByRole("button", { name: /Go back to this version/ }).click();
    await expect(page.getByRole("dialog")).toContainText("LKR 39,900 per family");
    await page.getByLabel("Why? (shown in the history)").fill("Price was approved for Colombo only");
    await page.getByRole("button", { name: "Yes, make version 3 live" }).click();
    await expect(page.getByText(/live again as version 5/)).toBeVisible();
    expect(await (await request.get("/s/summer-escape-galle/en")).text()).toContain("LKR 45,000 per family");
    // The draft was corrected too, but the colleague's unrelated pending edit was kept.
    await page.goto("/app/sites/site_galle/publish");
    await expect(page.getByText("Offers › Couples’ Hideaway › Offer description (English)")).toBeVisible();
    await expect(page.getByText(/Price \(English\)/)).toHaveCount(0);
  });

  test("6. a failed launch keeps the live website working and explains what to do", async ({ page, request }) => {
    await login(page, /Amara Perera/);
    await page.goto("/app/sites/site_kandy/settings");
    await page.getByTestId("simulate-failure").check();
    await page.waitForTimeout(500);
    await page.goto("/app/sites/site_kandy/edit?section=hero");
    await page.locator('[id="f-hero.title.en"]').fill("Kandy, the hill capital.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved to the draft/)).toBeVisible();
    await page.goto("/app/sites/site_kandy/publish");
    await page.getByRole("button", { name: /Publish 1 change/ }).click();
    await expect(page.getByText("The launch failed")).toBeVisible();
    await expect(page.getByText(/version 2, as before/)).toBeVisible();
    expect(await (await request.get("/s/summer-escape-kandy/en")).text()).toContain("Your next escape starts here.");

    await page.goto("/app");
    await expect(page.getByText("Launch failed").first()).toBeVisible();
    await page.goto("/app/sites/site_kandy");
    await expect(page.getByTestId("failed-launch")).toContainText("What to do");
    await page.getByRole("button", { name: /Try again/ }).click();
    await expect(page.getByText("Launched successfully")).toBeVisible();
    expect(await (await request.get("/s/summer-escape-kandy/en")).text()).toContain("Kandy, the hill capital.");
  });

  test("7. two colleagues edit the same text – nothing is silently overwritten", async ({ browser }) => {
    const nuwan = await newUser(browser, /Nuwan Silva/);
    const priya = await newUser(browser, /Priya Raj/);
    for (const p of [nuwan, priya]) await p.goto("/app/sites/site_colombo/edit?section=offers");
    const price = '[id="f-offers.items.@fam-beach.price.en"]';
    const desc = '[id="f-offers.items.@couple-retreat.description.en"]';

    await nuwan.locator(price).fill("LKR 41,000 per family");
    await nuwan.getByRole("button", { name: "Save draft" }).click();
    await expect(nuwan.getByText(/Saved to the draft/)).toBeVisible();

    // Priya started from the old version: one different field (auto-combined) and the same field (conflict).
    await priya.locator(desc).fill("2 nights in a sea-view villa.");
    await priya.locator(price).fill("LKR 42,500 per family");
    await priya.getByRole("button", { name: "Save draft" }).click();
    const dialog = priya.getByRole("dialog");
    await expect(dialog).toContainText("A colleague changed the same text");
    await expect(dialog.getByTestId("conflict")).toContainText("LKR 41,000 per family");
    await dialog.getByRole("button", { name: "Save with these choices" }).click(); // default: keep mine
    await expect(priya.getByText(/combined with Nuwan Silva/)).toBeVisible();

    await priya.goto("/app/sites/site_colombo/publish");
    await expect(priya.getByText("LKR 42,500 per family")).toBeVisible();
    await expect(priya.getByText("2 nights in a sea-view villa.")).toBeVisible();
  });

  test("8. people only see and do what they are responsible for", async ({ page, request }) => {
    await login(page, /Dilan Fernando/);
    await expect(page.getByTestId("site-card-arugam-bay-surf-camp")).toBeVisible();
    await expect(page.getByText("Summer Escape – Galle")).toHaveCount(0);
    const res = await page.goto("/app/sites/site_galle");
    expect(res?.status()).toBe(404);

    await login(page, /Nuwan Silva/);
    await page.goto("/app/sites/site_colombo/publish");
    await expect(page.getByText("Only reviewers can publish.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Transfer" })).toHaveCount(0);
    expect((await request.get("/robots.txt")).status()).toBe(200);
  });

  test("9. backups and moving a website to another workspace", async ({ page, request }) => {
    await login(page, /Amara Perera/);
    // Restore a whole website from a backup, after seeing what will be replaced.
    await page.goto("/app/sites/site_galle/backups");
    await page.getByRole("listitem").filter({ hasText: "Before the main summer campaign" }).getByRole("button", { name: "Restore…" }).click();
    await expect(page.getByRole("dialog")).toContainText("Will be replaced");
    await page.getByRole("button", { name: "Restore this backup" }).click();
    await expect(page.getByText(/live as version 6/)).toBeVisible();
    expect(await (await request.get("/s/summer-escape-galle/en")).text()).toContain("Early summer offer: Save up to 15%");
    await expect(page.getByText(/Safety backup before restoring/)).toBeVisible();

    // Export a package without private details, import it into the partner workspace.
    await page.goto("/app/sites/site_galle/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download website package/ }).click();
    const file = await (await download).path();
    const fs = await import("node:fs");
    const text = fs.readFileSync(file!, "utf8");
    expect(text).not.toContain("galle@summerescape.example");
    expect(text).not.toContain("Kavindi"); // enquiries never exported
    await page.getByLabel("Workspace").selectOption("ws_partner");
    await expect(page.getByLabel("Workspace")).toHaveValue("ws_partner");
    await page.goto("/app/transfer");
    await page.getByLabel("Website package").setInputFiles(file!);
    await page.getByRole("button", { name: /Import/ }).click();
    await expect(page.getByText("Website imported")).toBeVisible();
    await page.getByRole("link", { name: "Open it" }).click();
    await expect(page.locator("h1")).toHaveText("Summer Escape – Galle");
    await expect(page.getByText("Not live yet")).toBeVisible();
    await page.getByLabel("Workspace").selectOption("ws_main");
  });

  test("10. an admin adds a colleague and decides which clients they work on", async ({ page, browser }) => {
    await login(page, /Amara Perera/);
    await page.getByRole("link", { name: "People" }).click();
    await page.waitForURL("**/app/team");

    await page.getByRole("button", { name: "Add a person" }).click();
    await page.getByLabel("Full name").fill("Tharindu Jayasuriya");
    await page.getByLabel("Email (used to sign in)").fill("tharindu@sitedesk.demo");
    await page.getByLabel("Job title").fill("Content editor");
    await page.getByLabel("First password (at least 8 characters)").fill("demo1234");
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText(/Tharindu Jayasuriya was added/)).toBeVisible();

    // A new person sees nothing at all until they are given a client.
    const theirs = await loginWith(browser, "tharindu@sitedesk.demo", "demo1234");
    await expect(theirs.getByText(/don’t have access to any clients/i)).toBeVisible();
    expect((await theirs.goto("/app/sites/site_galle"))?.status()).toBe(404);

    // Give them editor access to one client only.
    const row = page.getByTestId("team-row-tharindu@sitedesk.demo");
    await row.getByLabel(/access to Summer Escape Travel/).selectOption("editor");
    await expect(page.getByText(/Summer Escape Travel: content editor/)).toBeVisible();

    await theirs.goto("/app");
    await expect(theirs.getByTestId("site-card-summer-escape-galle")).toBeVisible();
    await expect(theirs.getByText("Hill Country Tea Tours")).toHaveCount(0); // other client still hidden
    // Editors prepare but never publish.
    await theirs.goto("/app/sites/site_galle/publish");
    await expect(theirs.getByText("Only reviewers can publish.")).toBeVisible();

    // Taking the access away hides the client again.
    await row.getByLabel(/access to Summer Escape Travel/).selectOption("none");
    await theirs.goto("/app");
    await expect(theirs.getByTestId("site-card-summer-escape-galle")).toHaveCount(0);

    // The last admin cannot remove their own admin rights.
    // (click, not uncheck: the server refuses and the box stays ticked, which is the point)
    await page.getByTestId("team-row-amara@sitedesk.demo").getByLabel(/Operations admin/).click();
    await expect(page.getByText(/only operations admin/)).toBeVisible();
    await expect(page.getByTestId("team-row-amara@sitedesk.demo").getByLabel(/Operations admin/)).toBeChecked();

    // Every access change is recorded.
    await page.goto("/app/activity");
    await expect(page.getByText(/Tharindu Jayasuriya can now work on Summer Escape Travel/)).toBeVisible();
  });

  test("11. find text across every website, and export the activity log", async ({ page }) => {
    await login(page, /Amara Perera/);
    await page.getByRole("link", { name: "Find text" }).click();
    // "Which websites run this offer?" – the shared offer code is on all six Summer Escape sites.
    await page.getByLabel("Text to look for").fill("FAM-BEACH");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("search-summary")).toContainText("on 6 websites");
    await expect(page.getByTestId("search-site-site_trinco")).toBeVisible();
    // A website that does not run the offer is not listed.
    await expect(page.getByTestId("search-site-site_hill")).toHaveCount(0);

    await page.goto("/app/activity");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download as spreadsheet/ }).click();
    const fs = await import("node:fs");
    const csv = fs.readFileSync((await (await download).path())!, "utf8");
    expect(csv.split("\n")[0]).toContain("when,who,what,client,website,details");
    expect(csv).toContain("Tharindu Jayasuriya"); // the access changes from the previous step
  });
  test("12. the rest of a translation arrives: finish Sinhala and make it public", async ({ page, request }) => {
    await login(page, /Amara Perera/);
    await page.goto(`${siteUrl}/languages`);

    // The client sends the remaining texts (demo-files/sinhala-translations-rest.csv).
    await page.getByLabel("Translation file").setInputFiles(path.join(DEMO, "sinhala-translations-rest.csv"));
    const preview = page.getByTestId("import-preview");
    await expect(preview).toContainText("17 texts will be added or updated");
    await expect(preview).toContainText("Sinhala after import: complete ✓");
    await page.getByRole("button", { name: "Use these translations" }).click();
    await expect(page.getByText(/translations saved to the draft/)).toBeVisible();

    // Now – and only now – Sinhala can be made visible.
    const makeVisible = page.getByTestId("lang-si").getByRole("button", { name: "Make visible" });
    await expect(makeVisible).toBeEnabled();
    await makeVisible.click();
    await expect(page.getByText(/Sinhala is ready/)).toBeVisible();

    await page.goto(`${siteUrl}/publish`);
    await page.getByRole("button", { name: /^Publish \d+ change/ }).click();
    await expect(page.getByText(/is live/)).toBeVisible();

    // Sinhala is public now: it was 404 in step 3.
    const si = await request.get("/s/misty-mountain-retreats/si");
    expect(si.status()).toBe(200);
    expect(await si.text()).toContain("දිය ඇලි පා ගමන්"); // a text from the file we just imported
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/s/misty-mountain-retreats/si");
  });

  test("13. a client file with problems is reported, not half-applied", async ({ page }) => {
    await login(page, /Amara Perera/);
    await page.goto(`${siteUrl}/languages`);

    // The key column was deleted, so rows are matched by their English wording instead.
    await page.getByLabel("Translation file").setInputFiles(path.join(DEMO, "tamil-corrections-messy.csv"));
    const preview = page.getByTestId("import-preview");
    await expect(preview).toContainText("2 rows could not be placed");
    await expect(preview).toContainText("appears in 2 places"); // "Plan my trip" – menu button and CTA button
    await expect(preview).toContainText("No matching English text found for “Sunset Cruise Special”");
    await expect(preview).toContainText("2 texts will be added or updated"); // the good rows still import

    // The same kind of correction as JSON, the other accepted format.
    await page.reload();
    await page.getByLabel("Translation file").setInputFiles(path.join(DEMO, "tamil-corrections.json"));
    await expect(page.getByTestId("import-preview")).toContainText("3 texts will be added or updated");
  });

});
