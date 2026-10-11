/**
 * Translation files.
 *
 * The team downloads a spreadsheet (CSV) listing every text with its page, section and the
 * main-language wording, sends it to the client/translator, and uploads it back. Every row is
 * matched to its exact place on the website by its key. Rows without a key are matched by
 * their English (main-language) wording when that wording is unique.
 */
import { applyOps } from "../content/merge";
import type { EditOp, SiteContent } from "../content/types";
import { listTextFields, translationCoverage } from "../content/validate";
import { parseCsv, toCsv } from "./csv";
import { LANGUAGE_CATALOG, languageName } from "./languages";

export function buildTemplateCsv(content: SiteContent, locales: string[]): string {
  const main = content.settings.defaultLanguage;
  const targets = locales.filter((l) => l !== main);
  const header = ["key", "page", "section", "what this text is", main, ...targets];
  const rows = listTextFields(content).map((t) => [t.key, t.page, t.section, t.label, t.values[main] ?? "", ...targets.map((l) => t.values[l] ?? "")]);
  return toCsv([header, ...rows]);
}

export interface ImportEntry {
  row: number;
  key?: string;
  source?: string; // main-language text, used when there is no key
  values: Record<string, string>;
}

/** Recognise a language column header: "ta", "Tamil", "ta (Tamil)", "தமிழ்". */
export function headerToLocale(h: string): string | null {
  const v = h.trim().toLowerCase();
  if (!v) return null;
  const code = v.split(/[\s(]/)[0];
  const byCode = LANGUAGE_CATALOG.find((l) => l.code === code);
  if (byCode) return byCode.code;
  const byName = LANGUAGE_CATALOG.find((l) => l.name.toLowerCase() === v || l.nativeName.toLowerCase() === v);
  if (byName) return byName.code;
  if (/^[a-z]{2,3}(-[a-z]{2})?$/.test(v)) return v;
  return null;
}

export function parseTranslationFile(text: string, fileName: string, mainLanguage: string, targetLocale?: string): { entries: ImportEntry[]; error?: string } {
  const isJson = fileName.toLowerCase().endsWith(".json") || text.trim().startsWith("{");
  if (isJson) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { entries: [], error: "The file is not valid JSON. Please check it or use the CSV spreadsheet instead." };
    }
    if (!data || typeof data !== "object") return { entries: [], error: "The JSON file must contain an object." };
    const obj = data as Record<string, unknown>;
    const entries: ImportEntry[] = [];
    const allNested = Object.values(obj).every((v) => v && typeof v === "object");
    if (allNested) {
      // { "ta": { "hero.title": "..." } }
      let row = 0;
      for (const [locale, map] of Object.entries(obj)) {
        for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
          entries.push({ row: ++row, key, values: { [locale]: String(value ?? "") } });
        }
      }
    } else {
      if (!targetLocale) return { entries: [], error: "Choose which language this file contains." };
      let row = 0;
      for (const [key, value] of Object.entries(obj)) entries.push({ row: ++row, key, values: { [targetLocale]: String(value ?? "") } });
    }
    return { entries };
  }

  const rows = parseCsv(text);
  if (rows.length < 2) return { entries: [], error: "The spreadsheet is empty. Download the template, fill it in and upload it again." };
  const header = rows[0].map((h) => h.trim());
  const keyIdx = header.findIndex((h) => h.toLowerCase() === "key");
  const localeCols: Array<{ idx: number; locale: string }> = [];
  header.forEach((h, idx) => {
    if (["key", "page", "section", "what this text is", "label"].includes(h.toLowerCase())) return;
    const lower = h.toLowerCase();
    if ((lower === "text" || lower === "translation") && targetLocale) {
      localeCols.push({ idx, locale: targetLocale });
      return;
    }
    const loc = headerToLocale(h);
    if (loc) localeCols.push({ idx, locale: loc });
  });
  if (!localeCols.length) return { entries: [], error: "No language columns were found. The first row should contain column names such as key, en, ta." };
  if (keyIdx === -1 && !localeCols.some((c) => c.locale === mainLanguage)) {
    return { entries: [], error: `The spreadsheet needs a “key” column, or a “${mainLanguage}” column with the ${languageName(mainLanguage)} text so rows can be matched.` };
  }
  const entries: ImportEntry[] = rows.slice(1).map((r, i) => {
    const values: Record<string, string> = {};
    for (const c of localeCols) values[c.locale] = (r[c.idx] ?? "").trim();
    return { row: i + 2, key: keyIdx >= 0 ? (r[keyIdx] ?? "").trim() || undefined : undefined, source: values[mainLanguage], values };
  });
  return { entries };
}

export interface ImportMatch {
  key: string;
  locale: string;
  page: string;
  section: string;
  label: string;
  before: string;
  after: string;
  matchedBy: "key" | "main-language text";
}

export interface ImportPlan {
  matches: ImportMatch[];
  unchangedCount: number;
  emptyCount: number;
  unknownRows: Array<{ row: number; reason: string }>;
  languagesNotOnSite: string[];
  ops: EditOp[];
  /** Missing texts per language after the import is applied. */
  missingAfter: Record<string, number>;
}

/**
 * Works out exactly what an import would change. Nothing is applied here.
 * The main language is never overwritten by an import.
 */
export function planImport(content: SiteContent, entries: ImportEntry[]): ImportPlan {
  const fields = listTextFields(content);
  const main = content.settings.defaultLanguage;
  const siteLocales = content.settings.languages.map((l) => l.id).filter((l) => l !== main);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const plan: ImportPlan = { matches: [], unchangedCount: 0, emptyCount: 0, unknownRows: [], languagesNotOnSite: [], ops: [], missingAfter: {} };
  const notOnSite = new Set<string>();

  for (const e of entries) {
    let field = e.key ? byKey.get(e.key) : undefined;
    let matchedBy: ImportMatch["matchedBy"] = "key";
    if (!field && !e.key && e.source) {
      const candidates = fields.filter((f) => (f.values[main] ?? "").trim() === e.source!.trim());
      if (candidates.length === 1) {
        field = candidates[0];
        matchedBy = "main-language text";
      } else if (candidates.length > 1) {
        plan.unknownRows.push({ row: e.row, reason: `“${e.source}” appears in ${candidates.length} places – add the key column so it goes to the right place.` });
        continue;
      }
    }
    if (!field) {
      plan.unknownRows.push({ row: e.row, reason: e.key ? `Unknown key “${e.key}” – the text may have been removed from the website.` : `No matching ${languageName(main)} text found for “${e.source ?? ""}”.` });
      continue;
    }
    for (const [locale, value] of Object.entries(e.values)) {
      if (locale === main) continue;
      if (!siteLocales.includes(locale)) {
        if (value) notOnSite.add(locale);
        continue;
      }
      if (!value) {
        plan.emptyCount++;
        continue;
      }
      const before = field.values[locale] ?? "";
      if (before === value) {
        plan.unchangedCount++;
        continue;
      }
      plan.matches.push({ key: field.key, locale, page: field.page, section: field.section, label: field.label, before, after: value, matchedBy });
      plan.ops.push({ op: "set", path: `${field.key}.${locale}`, value });
    }
  }
  plan.languagesNotOnSite = [...notOnSite];
  const after = applyOps(content, plan.ops).content;
  for (const l of siteLocales) plan.missingAfter[l] = translationCoverage(after, l).missing.length;
  return plan;
}
