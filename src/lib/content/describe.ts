/**
 * Turns technical field paths into plain language a non-technical colleague can read,
 * e.g. "offers.items.@fam-beach.price.ta" → "Offers › Family Beach Package › Price (Tamil)".
 */
import { languageName } from "../i18n/languages";
import { getAt, ORDER, splitPath } from "./paths";
import { FieldDef, ListDef, PAGE_LABELS, SECTIONS, SETTINGS_FIELDS, SectionDef } from "./registry";

export interface ParsedPath {
  path: string;
  section?: SectionDef;
  list?: ListDef;
  itemId?: string;
  field?: FieldDef;
  locale?: string;
  isOrder: boolean;
  /** settings.languages.* */
  languageId?: string;
  isSettings: boolean;
}

export function parsePath(path: string): ParsedPath {
  const segs = splitPath(path);
  const res: ParsedPath = { path, isOrder: segs[segs.length - 1] === ORDER, isSettings: segs[0] === "settings" };
  if (res.isSettings) {
    if (segs[1] === "languages") {
      if (segs[2]?.startsWith("@")) res.languageId = segs[2].slice(1);
    } else {
      res.field = SETTINGS_FIELDS.find((f) => f.key === segs[1]);
    }
    return res;
  }
  const section = SECTIONS.find((s) => s.id === segs[0]);
  res.section = section;
  if (!section) return res;
  if (section.list && segs[1] === section.list.key) {
    res.list = section.list;
    if (segs[2]?.startsWith("@")) {
      res.itemId = segs[2].slice(1);
      res.field = section.list.fields.find((f) => f.key === segs[3]);
      if (res.field?.localized && segs[4]) res.locale = segs[4];
    }
    return res;
  }
  res.field = section.fields.find((f) => f.key === segs[1]);
  if (res.field?.localized && segs[2]) res.locale = segs[2];
  return res;
}

/** Name of a list item in plain language, using its English (or main-language) title. */
export function itemName(content: unknown, sectionId: string, list: ListDef, itemId: string): string {
  const item = getAt(content, `${sectionId}.${list.key}.@${itemId}`) as Record<string, unknown> | undefined;
  if (!item) return `${list.itemLabel.toLowerCase()} "${itemId}"`;
  const title = item[list.titleField];
  if (title && typeof title === "object") {
    const t = title as Record<string, string>;
    const defaultLang = (getAt(content, "settings.defaultLanguage") as string) || "en";
    return t[defaultLang] || t.en || Object.values(t).find(Boolean) || itemId;
  }
  return typeof title === "string" && title ? title : itemId;
}

export interface FieldDescription {
  page: string;
  section: string;
  item?: string;
  field: string;
  language?: string;
  /** "Offers › Family Beach Package › Price (Tamil)" */
  full: string;
}

/** `contents` are searched in order to find item names (pass the newer content first). */
export function describePath(path: string, ...contents: unknown[]): FieldDescription {
  const p = parsePath(path);
  const findItemName = (sectionId: string, list: ListDef, itemId: string) => {
    for (const c of contents) {
      if (getAt(c, `${sectionId}.${list.key}.@${itemId}`)) return itemName(c, sectionId, list, itemId);
    }
    return itemId;
  };

  if (p.isSettings) {
    if (p.languageId) {
      const name = languageName(p.languageId);
      return { page: "Settings", section: "Languages", field: `${name} visible to visitors`, language: p.languageId, full: `Languages › ${name} visible to visitors` };
    }
    if (p.isOrder) return { page: "Settings", section: "Languages", field: "Languages offered", full: "Languages › Languages offered" };
    const label = p.field?.label ?? path;
    return { page: "Settings", section: "Settings", field: label, full: `Settings › ${label}` };
  }
  if (!p.section) return { page: "", section: "", field: path, full: path };
  const page = PAGE_LABELS[p.section.page];
  const language = p.locale ? languageName(p.locale) : undefined;
  if (p.list) {
    if (p.isOrder) {
      return { page, section: p.section.label, field: `List of ${p.list.itemLabel.toLowerCase()}s`, full: `${p.section.label} › List of ${p.list.itemLabel.toLowerCase()}s` };
    }
    const item = p.itemId ? findItemName(p.section.id, p.list, p.itemId) : undefined;
    const field = p.field?.label ?? "";
    return {
      page,
      section: p.section.label,
      item,
      field,
      language,
      full: [p.section.label, item, field].filter(Boolean).join(" › ") + (language ? ` (${language})` : ""),
    };
  }
  const field = p.field?.label ?? path;
  return { page, section: p.section.label, field, language, full: `${p.section.label} › ${field}${language ? ` (${language})` : ""}` };
}

export function formatValue(v: unknown): string {
  if (v === undefined || v === null || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "On" : "Off";
  return String(v);
}
