/**
 * Updating several websites together.
 *
 * The team chooses WHAT (an offer, by its shared offer code, or a contact detail), WHERE (which
 * websites and which languages) and the NEW value. `planBulkChange` lists exactly which value on
 * which website will change, and what stays as it is. Nothing is saved here.
 */
import { formatValue } from "./content/describe";
import type { EditOp, SiteContent } from "./content/types";
import { languageName } from "./i18n/languages";

export type BulkTarget =
  | { kind: "offer"; code: string; field: "price" | "title" | "description" }
  | { kind: "contact"; field: "email" | "phone" | "whatsapp" };

export const OFFER_FIELD_LABELS = { price: "Price", title: "Offer name", description: "Offer description" } as const;
export const CONTACT_FIELD_LABELS = { email: "Email address", phone: "Phone number", whatsapp: "WhatsApp number" } as const;

export function targetIsLocalized(t: BulkTarget): boolean {
  return t.kind === "offer";
}

export function targetLabel(t: BulkTarget): string {
  return t.kind === "offer" ? `${OFFER_FIELD_LABELS[t.field]} of offer ${t.code}` : CONTACT_FIELD_LABELS[t.field];
}

export interface BulkSite {
  id: string;
  name: string;
  content: SiteContent; // the current draft
}

export interface BulkChange {
  siteId: string;
  siteName: string;
  path: string;
  locale?: string;
  label: string;
  before: string;
  after: string;
}

export interface BulkPlan {
  changes: BulkChange[];
  /** Selected places that already have the new value. */
  alreadyCorrect: Array<{ siteName: string; label: string }>;
  /** Websites that use this offer/field but were NOT selected – they stay as they are. */
  notSelected: Array<{ siteId: string; siteName: string }>;
  /** Languages on the selected websites that were NOT selected – they stay as they are. */
  languagesLeftAlone: Array<{ siteName: string; language: string; value: string }>;
  /** Selected websites where the change cannot be made (e.g. offer missing, language missing). */
  problems: Array<{ siteName: string; message: string }>;
  opsBySite: Record<string, EditOp[]>;
}

/** Websites that this bulk target applies to (e.g. every website that runs offer FAM-BEACH). */
export function sitesUsingTarget(sites: BulkSite[], target: BulkTarget): BulkSite[] {
  if (target.kind === "contact") return sites;
  return sites.filter((s) => s.content.offers.items.some((o) => o.code === target.code));
}

/** All shared offer codes across the websites, with the websites that use each. */
export function offerCatalog(sites: BulkSite[]): Array<{ code: string; title: string; sites: Array<{ id: string; name: string }> }> {
  const map = new Map<string, { code: string; title: string; sites: Array<{ id: string; name: string }> }>();
  for (const s of sites) {
    for (const o of s.content.offers.items) {
      if (!o.code) continue;
      const entry = map.get(o.code) ?? { code: o.code, title: o.title[s.content.settings.defaultLanguage] || o.title.en || o.code, sites: [] };
      if (!entry.sites.some((x) => x.id === s.id)) entry.sites.push({ id: s.id, name: s.name });
      map.set(o.code, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.sites.length - a.sites.length || a.code.localeCompare(b.code));
}

export function planBulkChange(
  sites: BulkSite[],
  target: BulkTarget,
  selectedSiteIds: string[],
  locales: string[],
  newValue: string | Record<string, string>,
): BulkPlan {
  const plan: BulkPlan = { changes: [], alreadyCorrect: [], notSelected: [], languagesLeftAlone: [], problems: [], opsBySite: {} };
  const relevant = sitesUsingTarget(sites, target);
  const valueFor = (locale?: string) => (typeof newValue === "string" ? newValue : newValue[locale ?? ""] ?? "").trim();

  for (const site of relevant) {
    if (!selectedSiteIds.includes(site.id)) {
      plan.notSelected.push({ siteId: site.id, siteName: site.name });
      continue;
    }
    const ops: EditOp[] = [];
    if (target.kind === "offer") {
      const offer = site.content.offers.items.find((o) => o.code === target.code)!;
      const siteLocales = site.content.settings.languages.map((l) => l.id);
      for (const locale of locales) {
        const label = `Offer “${offer.title[site.content.settings.defaultLanguage] || offer.code}” › ${OFFER_FIELD_LABELS[target.field]} (${languageName(locale)})`;
        if (!siteLocales.includes(locale)) {
          plan.problems.push({ siteName: site.name, message: `This website has no ${languageName(locale)} version, so nothing changes there.` });
          continue;
        }
        const after = valueFor(locale);
        if (!after) {
          plan.problems.push({ siteName: site.name, message: `No new ${languageName(locale)} value was entered.` });
          continue;
        }
        const path = `offers.items.@${offer.id}.${target.field}.${locale}`;
        const before = offer[target.field][locale] ?? "";
        if (before === after) plan.alreadyCorrect.push({ siteName: site.name, label });
        else {
          plan.changes.push({ siteId: site.id, siteName: site.name, path, locale, label, before: formatValue(before), after });
          ops.push({ op: "set", path, value: after });
        }
      }
      for (const l of siteLocales.filter((x) => !locales.includes(x))) {
        plan.languagesLeftAlone.push({ siteName: site.name, language: languageName(l), value: formatValue(offer[target.field][l]) });
      }
    } else {
      const path = `contact.${target.field}`;
      const before = site.content.contact[target.field];
      const after = valueFor();
      const label = CONTACT_FIELD_LABELS[target.field];
      if (before === after) plan.alreadyCorrect.push({ siteName: site.name, label });
      else {
        plan.changes.push({ siteId: site.id, siteName: site.name, path, label, before: formatValue(before), after: formatValue(after) });
        ops.push({ op: "set", path, value: after });
      }
    }
    if (ops.length) plan.opsBySite[site.id] = ops;
  }
  return plan;
}
