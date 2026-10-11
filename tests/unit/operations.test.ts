import { describe, expect, it } from "vitest";
import { offerCatalog, planBulkChange } from "@/lib/bulk";
import { buildPackage, parsePackage, prepareCopy } from "@/lib/clone";
import { applyOps } from "@/lib/content/merge";
import { buildTemplateCsv, parseTranslationFile, planImport } from "@/lib/i18n/import";
import { parseCsv, toCsv } from "@/lib/i18n/csv";
import { can } from "@/lib/permissions";
import { HILL_COUNTRY_SINHALA_PARTIAL, HILL_COUNTRY_TAMIL, hillCountryContent, summerEscapeContent } from "@/server/seed-content";

const contact = { email: "a@b.example", phone: "+94 11 222 3333", whatsapp: "", street: "1 Main St" };
const sixSites = () => [
  { id: "colombo", name: "Colombo", content: summerEscapeContent("Colombo", ["en", "ta"], ["en", "ta"], contact) },
  { id: "galle", name: "Galle", content: summerEscapeContent("Galle", ["en", "ta", "si"], ["en", "ta", "si"], contact) },
  { id: "kandy", name: "Kandy", content: summerEscapeContent("Kandy", ["en", "ta"], ["en", "ta"], contact) },
  { id: "jaffna", name: "Jaffna", content: summerEscapeContent("Jaffna", ["en", "ta"], ["en", "ta"], contact) },
  { id: "trinco", name: "Trincomalee", content: summerEscapeContent("Trincomalee", ["en", "ta"], ["en", "ta"], contact) },
  { id: "ella", name: "Ella", content: summerEscapeContent("Ella", ["en", "si"], ["en", "si"], contact) },
];

describe("bulk update: price on 4 of 6 websites, English and Tamil only", () => {
  it("changes exactly 8 values and lists everything left alone", () => {
    const sites = sixSites();
    expect(offerCatalog(sites).find((o) => o.code === "FAM-BEACH")!.sites).toHaveLength(6);

    const plan = planBulkChange(sites, { kind: "offer", code: "FAM-BEACH", field: "price" }, ["colombo", "galle", "kandy", "jaffna"], ["en", "ta"], {
      en: "LKR 39,900 per family",
      ta: "ஒரு குடும்பத்திற்கு ரூ. 39,900",
    });
    expect(plan.changes).toHaveLength(8);
    expect(new Set(plan.changes.map((c) => c.siteId))).toEqual(new Set(["colombo", "galle", "kandy", "jaffna"]));
    expect(plan.notSelected.map((s) => s.siteId).sort()).toEqual(["ella", "trinco"]);
    expect(plan.languagesLeftAlone).toEqual([{ siteName: "Galle", language: "Sinhala", value: "පවුලකට රු. 45,000" }]);

    // Applying the plan to Galle changes only the two selected prices.
    const galle = sites[1].content;
    const after = applyOps(galle, plan.opsBySite.galle).content;
    expect(after.offers.items[0].price).toEqual({ en: "LKR 39,900 per family", ta: "ஒரு குடும்பத்திற்கு ரூ. 39,900", si: "පවුලකට රු. 45,000" });
    expect(after.offers.items[1]).toEqual(galle.offers.items[1]);
  });

  it("reports websites missing a selected language instead of silently skipping", () => {
    const plan = planBulkChange(sixSites(), { kind: "offer", code: "FAM-BEACH", field: "price" }, ["ella"], ["ta"], { ta: "x" });
    expect(plan.changes).toHaveLength(0);
    expect(plan.problems[0].message).toContain("no Tamil version");
  });

  it("updates shared contact details", () => {
    const plan = planBulkChange(sixSites(), { kind: "contact", field: "phone" }, ["colombo", "kandy"], [], "+94 11 555 0000");
    expect(plan.changes.map((c) => c.siteName)).toEqual(["Colombo", "Kandy"]);
    expect(plan.notSelected).toHaveLength(4);
  });
});

describe("translations", () => {
  it("round-trips the template and places each text in the right field", () => {
    const c = hillCountryContent();
    c.settings.languages.push({ id: "ta", public: false }, { id: "si", public: false });
    const csv = buildTemplateCsv(c, ["ta", "si"]);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(["key", "page", "section", "what this text is", "en", "ta", "si"]);
    // Translator fills in Tamil.
    const header = rows[0];
    const filled = [header, ...rows.slice(1).map((r) => { const copy = [...r]; copy[5] = HILL_COUNTRY_TAMIL[r[0]] ?? ""; return copy; })];
    const { entries, error } = parseTranslationFile(toCsv(filled), "tamil.csv", "en");
    expect(error).toBeUndefined();
    const plan = planImport(c, entries);
    expect(plan.unknownRows).toHaveLength(0);
    expect(plan.missingAfter.ta).toBe(0);
    const after = applyOps(c, plan.ops).content;
    expect(after.offers.items.find((o) => o.id === "rail-ella")!.price.ta).toBe("ஒருவருக்கு ரூ. 27,500");
    expect(after.hero.title.en).toBe("Wake up above the clouds."); // main language untouched
  });

  it("reports missing texts for a partial translation", () => {
    const c = hillCountryContent();
    c.settings.languages.push({ id: "si", public: false });
    const entries = Object.entries(HILL_COUNTRY_SINHALA_PARTIAL).map(([key, si], i) => ({ row: i + 2, key, values: { si } }));
    const plan = planImport(c, entries);
    expect(plan.matches.length).toBe(Object.keys(HILL_COUNTRY_SINHALA_PARTIAL).length);
    expect(plan.missingAfter.si).toBeGreaterThan(10);
  });

  it("matches rows by English text when there is no key, and flags unknown keys", () => {
    const c = hillCountryContent();
    c.settings.languages.push({ id: "ta", public: false });
    const csv = "en,ta\nWake up above the clouds.,மேகங்களுக்கு மேலே கண் விழியுங்கள்.\nSomething not on the site,x\n";
    const { entries } = parseTranslationFile(csv, "t.csv", "en");
    const plan = planImport(c, entries);
    expect(plan.matches[0]).toMatchObject({ key: "hero.title", matchedBy: "main-language text" });
    expect(plan.unknownRows).toHaveLength(1);
  });

  it("parses quoted CSV cells with commas and new lines", () => {
    expect(parseCsv('a,"b, c","d ""x""\nline"\r\n1,2,3')).toEqual([["a", "b, c", 'd "x"\nline'], ["1", "2", "3"]]);
  });
});

describe("copying and transferring websites", () => {
  it("never carries private client information into a copy", () => {
    const copy = prepareCopy(hillCountryContent(), "Misty Mountain Retreats");
    expect(copy.brand.name).toBe("Misty Mountain Retreats");
    expect(copy.contact.email).toBe("");
    expect(copy.contact.phone).toBe("");
    expect(copy.contact.address.en).toBe("");
    expect(copy.settings.gaId).toBe("");
    expect(copy.settings.gtmId).toBe("");
    expect(copy.offers.items).toHaveLength(2); // content is kept to adapt
  });

  it("exports a package without contact details or analytics unless asked, and validates imports", () => {
    const pkg = buildPackage({ name: "Hill", slug: "hill" }, hillCountryContent(), hillCountryContent(), { includeContact: false, includeAnalytics: false });
    const text = JSON.stringify(pkg);
    expect(text).not.toContain("hello@hillcountrytea.example");
    expect(text).not.toContain("G-HILLTEA26");
    expect(parsePackage(text).ok).toBe(true);
    expect(parsePackage('{"format":"something-else"}').ok).toBe(false);
  });
});

describe("footer social links", () => {
  it("are cleared on a copy, so one client’s accounts never appear on another’s website", () => {
    const source = hillCountryContent();
    expect(source.footer.instagram).toContain("hillcountryteatours");
    const copy = prepareCopy(source, "Misty Mountain Retreats");
    expect(copy.footer.instagram).toBe("");
    expect(copy.footer.facebook).toBe("");
    expect(copy.footer.youtube).toBe("");
    // The footer text itself is content, not private, so it is kept for the team to adapt.
    expect(copy.footer.tagline).toEqual(source.footer.tagline);
  });

  it("are not translatable, so they do not change what a translation file must contain", () => {
    const content = hillCountryContent();
    const keys = buildTemplateCsv(content, ["en", "ta"])
      .split("\r\n")
      .slice(1)
      .map((line) => line.split(",")[0]);
    expect(keys).toContain("footer.tagline");
    expect(keys.filter((k) => k.startsWith("footer."))).toEqual(["footer.tagline"]);
  });
});

describe("permissions", () => {
  const editor = { id: "u1", isAdmin: false, roles: { summer: "editor" as const } };
  const publisher = { id: "u2", isAdmin: false, roles: { summer: "publisher" as const } };
  it("editors prepare, publishers publish, nobody sees other clients", () => {
    expect(can(editor, "site.edit", "summer")).toBe(true);
    expect(can(editor, "site.publish", "summer")).toBe(false);
    expect(can(publisher, "site.publish", "summer")).toBe(true);
    expect(can(publisher, "site.view", "tea")).toBe(false);
    expect(can(publisher, "site.transfer")).toBe(false);
    expect(can({ id: "a", isAdmin: true, roles: {} }, "site.transfer")).toBe(true);
  });

  it("only operations admins can manage people and access", () => {
    // Managing people is workspace-wide, so it is never granted by a per-client role.
    expect(can(editor, "team.manage")).toBe(false);
    expect(can(publisher, "team.manage")).toBe(false);
    expect(can(publisher, "team.manage", "summer")).toBe(false);
    expect(can({ id: "a", isAdmin: true, roles: {} }, "team.manage")).toBe(true);
    expect(can(null, "team.manage")).toBe(false);
  });
});
