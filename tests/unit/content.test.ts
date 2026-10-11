import { describe, expect, it } from "vitest";
import { applySelected, diffContent, summarizeChanges } from "@/lib/content/diff";
import { describePath } from "@/lib/content/describe";
import { applyOps, mergeEdits } from "@/lib/content/merge";
import { clone, flatten, getAt, stableStringify } from "@/lib/content/paths";
import { translationCoverage, validateForPublish } from "@/lib/content/validate";
import { hillCountryContent, summerEscapeContent } from "@/server/seed-content";

const galle = () => summerEscapeContent("Galle", ["en", "ta", "si"], ["en", "ta", "si"], { email: "galle@x.example", phone: "+94 91 222 3344", whatsapp: "", street: "12 Church Street" });

describe("paths", () => {
  it("addresses list items by id, not position", () => {
    const c = galle();
    expect(getAt(c, "offers.items.@fam-beach.price.ta")).toBe("ஒரு குடும்பத்திற்கு ரூ. 45,000");
    expect(getAt(c, "offers.items.__order")).toBe("fam-beach,couple-retreat");
    const flat = flatten(c);
    expect(flat["offers.items.@couple-retreat.code"]).toBe("COUPLE-RETREAT");
    expect(Object.keys(flat).some((k) => k.endsWith(".id"))).toBe(false);
  });

  it("describes paths in plain language", () => {
    expect(describePath("offers.items.@fam-beach.price.ta", galle()).full).toBe("Offers › Family Beach Package › Price (Tamil)");
    expect(describePath("hero.title.en", galle()).full).toBe("Top banner › Main headline (English)");
    expect(describePath("settings.languages.@si.public", galle()).full).toBe("Languages › Sinhala visible to visitors");
  });
});

describe("diff and selective publish", () => {
  it("publishing every change gives exactly the draft", () => {
    const live = galle();
    const draft = clone(live);
    draft.hero.title.en = "New headline";
    draft.offers.items[0].price.ta = "ரூ. 39,900";
    draft.offers.items.reverse();
    draft.categories.items.push({ id: "new-cat", title: { en: "Wildlife", ta: "வனவிலங்கு", si: "වනජීවී" }, text: { en: "Safari", ta: "சஃபாரி", si: "සෆාරි" }, image: "/demo/nature.svg" });
    draft.categories.items = draft.categories.items.filter((c) => c.id !== "city");
    const raw = diffContent(live, draft);
    const result = applySelected(live, draft, raw.map((r) => r.path));
    expect(stableStringify(result)).toBe(stableStringify(draft));
  });

  it("publishing only Tamil changes leaves English untouched", () => {
    const live = galle();
    const draft = clone(live);
    draft.hero.title.en = "English change (not ready)";
    draft.hero.title.ta = "தமிழ் மாற்றம்";
    const changes = summarizeChanges(diffContent(live, draft), live, draft);
    const tamilPaths = changes.filter((c) => c.locale === "ta").flatMap((c) => c.paths);
    const next = applySelected(live, draft, tamilPaths);
    expect(next.hero.title.ta).toBe("தமிழ் மாற்றம்");
    expect(next.hero.title.en).toBe(live.hero.title.en);
  });

  it("groups added/removed list items into one readable change", () => {
    const live = galle();
    const draft = clone(live);
    draft.offers.items.push({ id: "fort", code: "FORT-WALK", title: { en: "Galle Fort Walk", ta: "", si: "" }, description: { en: "d", ta: "", si: "" }, price: { en: "LKR 5,000", ta: "", si: "" }, image: "/demo/city.svg" });
    const changes = summarizeChanges(diffContent(live, draft), live, draft);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("list");
    expect(changes[0].detail).toBe("Added offer “Galle Fort Walk”");
  });
});

describe("two people editing at once", () => {
  it("combines edits to different fields automatically", () => {
    const base = galle();
    const theirs = applyOps(base, [{ op: "set", path: "hero.title.en", value: "Their headline" }]).content;
    const res = mergeEdits(base, theirs, [{ op: "set", path: "offers.items.@fam-beach.price.en", value: "LKR 39,900 per family" }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.content.hero.title.en).toBe("Their headline");
      expect(res.content.offers.items[0].price.en).toBe("LKR 39,900 per family");
      expect(res.mergedWithOthers).toBe(1);
    }
  });

  it("reports a conflict when both changed the same field", () => {
    const base = galle();
    const theirs = applyOps(base, [{ op: "set", path: "offers.items.@fam-beach.price.en", value: "LKR 42,000 per family" }]).content;
    const res = mergeEdits(base, theirs, [{ op: "set", path: "offers.items.@fam-beach.price.en", value: "LKR 39,900 per family" }]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.conflicts[0]).toMatchObject({ reason: "same-field", yours: "LKR 39,900 per family", theirs: "LKR 42,000 per family" });
    }
  });

  it("reports a conflict when editing an item a colleague removed", () => {
    const base = galle();
    const theirs = applyOps(base, [{ op: "removeItem", list: "offers.items", id: "couple-retreat" }]).content;
    const res = mergeEdits(base, theirs, [{ op: "set", path: "offers.items.@couple-retreat.price.en", value: "LKR 30,000" }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.conflicts[0].reason).toBe("item-removed");
  });

  it("reports a conflict when removing an item a colleague just edited", () => {
    const base = galle();
    const theirs = applyOps(base, [{ op: "set", path: "offers.items.@couple-retreat.price.en", value: "LKR 30,000" }]).content;
    const res = mergeEdits(base, theirs, [{ op: "removeItem", list: "offers.items", id: "couple-retreat" }]);
    expect(res.ok).toBe(false);
  });
});

describe("publish checks", () => {
  it("blocks a visible language with missing texts and allows a hidden one", () => {
    const c = hillCountryContent();
    c.settings.languages.push({ id: "ta", public: false });
    expect(validateForPublish(c).filter((i) => i.severity === "error")).toHaveLength(0);
    c.settings.languages[1].public = true;
    const errors = validateForPublish(c).filter((i) => i.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Tamil is visible to visitors but");
  });

  it("validates analytics IDs and contact details", () => {
    const c = hillCountryContent();
    c.settings.gaId = "UA-1234";
    c.contact.email = "not-an-email";
    const msgs = validateForPublish(c).map((i) => i.message).join("\n");
    expect(msgs).toContain("G-AB12CD34EF");
    expect(msgs).toContain("does not look like an email");
  });

  it("measures translation progress", () => {
    const c = hillCountryContent();
    c.settings.languages.push({ id: "ta", public: false });
    const cov = translationCoverage(c, "ta");
    expect(cov.done).toBe(0);
    expect(cov.total).toBeGreaterThan(40);
  });
});
