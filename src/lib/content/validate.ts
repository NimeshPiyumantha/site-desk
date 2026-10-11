/**
 * Translation progress and the checks that run before anything goes live.
 */
import { languageName } from "../i18n/languages";
import { describePath } from "./describe";
import { FieldDef, PAGE_LABELS, SECTIONS } from "./registry";
import type { SiteContent } from "./types";

export interface TextField {
  /** Path without language, e.g. "offers.items.@fam-beach.title" */
  key: string;
  page: string;
  section: string;
  label: string;
  field: FieldDef;
  values: Record<string, string>;
}

/** Every translatable text on the website, in the order it appears. */
export function listTextFields(content: SiteContent): TextField[] {
  const out: TextField[] = [];
  for (const section of SECTIONS) {
    const sectionObj = (content as unknown as Record<string, Record<string, unknown>>)[section.id] ?? {};
    for (const f of section.fields.filter((x) => x.localized)) {
      const key = `${section.id}.${f.key}`;
      out.push({ key, page: PAGE_LABELS[section.page], section: section.label, label: describePath(key, content).full, field: f, values: (sectionObj[f.key] as Record<string, string>) ?? {} });
    }
    if (section.list) {
      const items = (sectionObj[section.list.key] as Array<Record<string, unknown>>) ?? [];
      for (const item of items) {
        for (const f of section.list.fields.filter((x) => x.localized)) {
          const key = `${section.id}.${section.list.key}.@${item.id}.${f.key}`;
          out.push({ key, page: PAGE_LABELS[section.page], section: section.label, label: describePath(key, content).full, field: f, values: (item[f.key] as Record<string, string>) ?? {} });
        }
      }
    }
  }
  return out;
}

/** A text needs translating if it is required, or if it has text in the main language. */
function needsTranslation(t: TextField, defaultLanguage: string): boolean {
  return Boolean(t.field.required) || Boolean((t.values[defaultLanguage] ?? "").trim());
}

export interface Coverage {
  locale: string;
  total: number;
  done: number;
  percent: number;
  missing: TextField[];
}

export function translationCoverage(content: SiteContent, locale: string): Coverage {
  const needed = listTextFields(content).filter((t) => needsTranslation(t, content.settings.defaultLanguage));
  const missing = needed.filter((t) => !(t.values[locale] ?? "").trim());
  const done = needed.length - missing.length;
  return { locale, total: needed.length, done, percent: needed.length ? Math.floor((done / needed.length) * 100) : 100, missing };
}

export interface Issue {
  severity: "error" | "warning";
  message: string;
  /** What the person should do about it. */
  fix: string;
  path?: string;
  locale?: string;
}

const GA_RE = /^G-[A-Z0-9]{4,12}$/;
const GTM_RE = /^GTM-[A-Z0-9]{4,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export function validateGaId(v: string): string | null {
  if (!v) return null;
  return GA_RE.test(v.trim()) ? null : "A Google Analytics ID looks like G-AB12CD34EF (starts with “G-”).";
}
export function validateGtmId(v: string): string | null {
  if (!v) return null;
  return GTM_RE.test(v.trim()) ? null : "A Google Tag Manager ID looks like GTM-AB12CD3 (starts with “GTM-”).";
}

/** Checks the content that is about to go live. Errors block the launch; warnings do not. */
export function validateForPublish(content: SiteContent): Issue[] {
  const issues: Issue[] = [];
  const s = content.settings;
  const publicLangs = s.languages.filter((l) => l.public).map((l) => l.id);

  if (!s.languages.some((l) => l.id === s.defaultLanguage && l.public)) {
    issues.push({ severity: "error", message: `The main language (${languageName(s.defaultLanguage)}) is not visible to visitors.`, fix: "Open Languages and make the main language visible." });
  }
  if (!content.brand.name.trim()) issues.push({ severity: "error", message: "The business name is empty.", fix: "Fill in Brand & look › Business name.", path: "brand.name" });

  for (const sec of SECTIONS) {
    // Optional links (e.g. social media) must still be a real web address if filled in.
    for (const f of sec.fields.filter((x) => x.type === "url")) {
      const v = String((content as unknown as Record<string, Record<string, unknown>>)[sec.id][f.key] ?? "").trim();
      if (v && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(v)) {
        issues.push({
          severity: "error",
          message: `${describePath(`${sec.id}.${f.key}`, content).full} is not a web address: “${v}”.`,
          fix: "Use the full address including https://, for example https://instagram.com/yourclient – or leave it empty.",
          path: `${sec.id}.${f.key}`,
        });
      }
    }
    for (const f of sec.fields.filter((x) => x.type === "image" && x.required)) {
      const v = (content as unknown as Record<string, Record<string, string>>)[sec.id][f.key];
      if (!v) issues.push({ severity: "error", message: `${describePath(`${sec.id}.${f.key}`, content).full} has no picture.`, fix: "Choose a picture in the editor.", path: `${sec.id}.${f.key}` });
    }
    if (sec.list) {
      const items = (content as unknown as Record<string, Record<string, Array<Record<string, string>>>>)[sec.id][sec.list.key] ?? [];
      for (const item of items) {
        for (const f of sec.list.fields.filter((x) => !x.localized && x.required)) {
          if (!String(item[f.key] ?? "").trim()) {
            const path = `${sec.id}.${sec.list.key}.@${item.id}.${f.key}`;
            issues.push({ severity: "error", message: `${describePath(path, content).full} is empty.`, fix: "Fill it in the editor.", path });
          }
        }
      }
    }
  }

  for (const lang of publicLangs) {
    const cov = translationCoverage(content, lang);
    if (cov.missing.length) {
      const examples = cov.missing.slice(0, 3).map((m) => m.label).join("; ");
      issues.push({
        severity: "error",
        message: `${languageName(lang)} is visible to visitors but ${cov.missing.length} text${cov.missing.length === 1 ? " is" : "s are"} missing (${examples}${cov.missing.length > 3 ? "…" : ""}).`,
        fix: `Add the missing ${languageName(lang)} texts, or keep ${languageName(lang)} hidden until it is ready.`,
        locale: lang,
      });
    }
  }
  for (const l of s.languages.filter((x) => !x.public)) {
    const cov = translationCoverage(content, l.id);
    if (cov.missing.length) {
      issues.push({ severity: "warning", message: `${languageName(l.id)} stays hidden from visitors (${cov.percent}% translated).`, fix: "Nothing to do now – it will stay private until you make it visible.", locale: l.id });
    }
  }

  const c = content.contact;
  if (!c.email.trim() && !c.phone.trim()) {
    issues.push({ severity: "error", message: "The website has no contact email or phone number.", fix: "Add at least one in Contact details.", path: "contact.email" });
  }
  if (c.email.trim() && !EMAIL_RE.test(c.email.trim())) issues.push({ severity: "error", message: `“${c.email}” does not look like an email address.`, fix: "Correct it in Contact details.", path: "contact.email" });
  for (const key of ["phone", "whatsapp"] as const) {
    if (c[key].trim() && !PHONE_RE.test(c[key].trim())) issues.push({ severity: "error", message: `“${c[key]}” does not look like a phone number.`, fix: "Use digits, spaces and an optional + (e.g. +94 77 123 4567).", path: `contact.${key}` });
  }
  const ga = validateGaId(s.gaId);
  if (ga) issues.push({ severity: "error", message: ga, fix: "Correct it in Settings › Analytics.", path: "settings.gaId" });
  const gtm = validateGtmId(s.gtmId);
  if (gtm) issues.push({ severity: "error", message: gtm, fix: "Correct it in Settings › Analytics.", path: "settings.gtmId" });
  if (!s.gaId && !s.gtmId) issues.push({ severity: "warning", message: "No Google Analytics or Tag Manager ID – visits will not be measured.", fix: "Optional: add the IDs in Settings › Analytics." });

  return issues;
}
