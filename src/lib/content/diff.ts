/**
 * Comparing two versions of a website, describing the difference in plain language,
 * and publishing only a selected part of the difference.
 */
import { languageName } from "../i18n/languages";
import { describePath, formatValue, parsePath } from "./describe";
import { clone, flatten, getAt, itemPrefix, Leaf, listPathOf, ORDER, setAt } from "./paths";
import { sectionById } from "./registry";

export interface RawChange {
  path: string;
  before: Leaf | undefined;
  after: Leaf | undefined;
}

export function diffContent(before: unknown, after: unknown): RawChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: RawChange[] = [];
  for (const k of keys) {
    if (a[k] !== b[k]) out.push({ path: k, before: a[k], after: b[k] });
  }
  return out.sort((x, y) => x.path.localeCompare(y.path));
}

export interface DisplayChange {
  /** Stable id for this change (used by checkboxes on the publish screen). */
  id: string;
  /** All raw paths that make up this change. Publishing the change publishes exactly these. */
  paths: string[];
  kind: "field" | "list" | "language";
  /** Language this change belongs to; undefined = shared by all languages. */
  locale?: string;
  page: string;
  section: string;
  /** "Offers › Family Beach Package › Price (Tamil)" */
  label: string;
  /** "LKR 45,000 → LKR 39,900" or "Added offer “Hill Country Rail Trip”" */
  detail: string;
  before?: string;
  after?: string;
}

/**
 * Groups raw changes into changes a person can understand:
 * - one entry per edited field,
 * - one entry per list whose items were added / removed / reordered (including all fields of added/removed items),
 * - one entry per language made visible / hidden.
 */
export function summarizeChanges(raw: RawChange[], before: unknown, after: unknown): DisplayChange[] {
  const out: DisplayChange[] = [];
  const listGroups = new Map<string, RawChange[]>();

  for (const ch of raw) {
    const listPath = listPathOf(ch.path);
    if (listPath) {
      const prefix = itemPrefix(ch.path);
      const structural = ch.path.endsWith(`.${ORDER}`) || (prefix !== null && (getAt(before, prefix) === undefined || getAt(after, prefix) === undefined));
      if (structural) {
        const g = listGroups.get(listPath) ?? [];
        g.push(ch);
        listGroups.set(listPath, g);
        continue;
      }
    }
    const desc = describePath(ch.path, after, before);
    const p = parsePath(ch.path);
    if (p.languageId) {
      out.push({
        id: ch.path,
        paths: [ch.path],
        kind: "language",
        locale: p.languageId,
        page: desc.page,
        section: desc.section,
        label: desc.full,
        detail: ch.after ? `${languageName(p.languageId)} becomes visible to visitors` : `${languageName(p.languageId)} is hidden from visitors`,
        before: formatValue(ch.before),
        after: formatValue(ch.after),
      });
      continue;
    }
    out.push({
      id: ch.path,
      paths: [ch.path],
      kind: "field",
      locale: p.locale,
      page: desc.page,
      section: desc.section,
      label: desc.full,
      detail: `${short(formatValue(ch.before))} → ${short(formatValue(ch.after))}`,
      before: formatValue(ch.before),
      after: formatValue(ch.after),
    });
  }

  for (const [listPath, changes] of listGroups) {
    const beforeIds = String(getAt(before, `${listPath}.${ORDER}`) ?? "").split(",").filter(Boolean);
    const afterIds = String(getAt(after, `${listPath}.${ORDER}`) ?? "").split(",").filter(Boolean);
    const added = afterIds.filter((id) => !beforeIds.includes(id));
    const removed = beforeIds.filter((id) => !afterIds.includes(id));
    const parts: string[] = [];
    const isLanguages = listPath === "settings.languages";
    const sectionId = listPath.split(".")[0];
    const section = sectionById(sectionId);
    const name = (content: unknown, id: string) => {
      if (isLanguages) return languageName(id);
      const d = describePath(`${listPath}.@${id}.${section?.list?.titleField ?? "title"}`, content);
      return `“${d.item ?? id}”`;
    };
    const itemLabel = isLanguages ? "language" : (section?.list?.itemLabel ?? "item").toLowerCase();
    if (added.length) parts.push(`Added ${itemLabel} ${added.map((id) => name(after, id)).join(", ")}`);
    if (removed.length) parts.push(`Removed ${itemLabel} ${removed.map((id) => name(before, id)).join(", ")}`);
    if (!added.length && !removed.length) parts.push(`Changed the order of the ${itemLabel}s`);
    // Make sure the order path itself is always included so the structure can be applied.
    const paths = new Set(changes.map((c) => c.path));
    paths.add(`${listPath}.${ORDER}`);
    const desc = describePath(`${listPath}.${ORDER}`, after, before);
    out.push({
      id: `${listPath}.${ORDER}`,
      paths: [...paths],
      kind: "list",
      page: desc.page,
      section: isLanguages ? "Languages" : desc.section,
      label: isLanguages ? "Languages › Languages offered" : desc.full,
      detail: parts.join("; "),
    });
  }
  return out;
}

function short(s: string, max = 80): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** One-line plain-language summary for a list of changes, e.g. for a version in the history. */
export function summaryLine(changes: DisplayChange[]): string {
  if (changes.length === 0) return "No content changes";
  const first = changes.slice(0, 2).map((c) => (c.kind === "field" ? `${c.label}: ${c.detail}` : c.detail));
  const more = changes.length > 2 ? ` and ${changes.length - 2} more change${changes.length - 2 === 1 ? "" : "s"}` : "";
  return first.join("; ") + more;
}

/**
 * Builds the next live content by taking `live` and copying over ONLY the selected paths from `draft`.
 * Everything not selected stays exactly as it is live. Selecting every changed path gives the draft.
 */
export function applySelected<T>(live: T, draft: T, selectedPaths: Iterable<string>): T {
  const result = clone(live) as unknown as Record<string, unknown>;
  const paths = [...new Set(selectedPaths)];
  // 1. Structure first: add / remove / reorder list items.
  for (const p of paths.filter((x) => x.endsWith(`.${ORDER}`))) {
    const listPath = p.slice(0, -(ORDER.length + 1));
    const draftList = getAt(draft, listPath) as Array<{ id: string }> | undefined;
    const liveList = (getAt(result, listPath) as Array<{ id: string }> | undefined) ?? [];
    if (!draftList) continue;
    const next = draftList.map((d) => liveList.find((l) => l.id === d.id) ?? clone(d));
    setAt(result, listPath, next);
  }
  // 2. Then individual values. Values inside items that do not exist live are skipped.
  for (const p of paths.filter((x) => !x.endsWith(`.${ORDER}`))) {
    setAt(result, p, getAt(draft, p));
  }
  return result as unknown as T;
}
