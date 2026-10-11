/**
 * Field paths.
 *
 * Every value in a website's content has a stable, readable address, for example
 *   hero.title.en                       – the English headline
 *   offers.items.@fam-beach.price.ta    – the Tamil price of the offer with id "fam-beach"
 *   offers.items.__order                – which offers exist, and in what order
 *
 * List items are addressed by id (`@id`), never by position, so two people editing
 * different offers never collide, and reordering a list never changes what a path means.
 */
export type Leaf = string | number | boolean | null;
export type FlatContent = Record<string, Leaf>;

export const ORDER = "__order";

export function splitPath(path: string): string[] {
  return path.split(".");
}

function isItemArray(v: unknown): v is Array<{ id: string }> {
  return Array.isArray(v) && v.every((x) => x !== null && typeof x === "object" && typeof (x as { id?: unknown }).id === "string");
}

/** Turn nested content into a flat { path: value } map. */
export function flatten(value: unknown, prefix = "", out: FlatContent = {}, insideItem = false): FlatContent {
  if (Array.isArray(value)) {
    if (isItemArray(value)) {
      out[join(prefix, ORDER)] = value.map((x) => x.id).join(",");
      for (const item of value) flatten(item, join(prefix, `@${item.id}`), out, true);
    } else {
      out[prefix] = JSON.stringify(value);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (insideItem && k === "id") continue;
      flatten(v, join(prefix, k), out, false);
    }
  } else if (value !== undefined) {
    out[prefix] = value as Leaf;
  }
  return out;
}

function join(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

/** Read the value at a path. Returns undefined when the path (or its list item) does not exist. */
export function getAt(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const seg of splitPath(path)) {
    if (cur === undefined || cur === null) return undefined;
    if (seg === ORDER) return isItemArray(cur) ? cur.map((x) => x.id).join(",") : undefined;
    if (seg.startsWith("@")) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur.find((x) => x && (x as { id: string }).id === seg.slice(1));
    } else {
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

/** The path of the list item that contains this path, e.g. "offers.items.@fam-beach". */
export function itemPrefix(path: string): string | null {
  const segs = splitPath(path);
  const idx = segs.findIndex((s) => s.startsWith("@"));
  return idx === -1 ? null : segs.slice(0, idx + 1).join(".");
}

/** The list path that contains this path, e.g. "offers.items". */
export function listPathOf(path: string): string | null {
  const segs = splitPath(path);
  const idx = segs.findIndex((s) => s.startsWith("@") || s === ORDER);
  return idx === -1 ? null : segs.slice(0, idx).join(".");
}

/**
 * Write a value. Missing plain objects are created; a missing list item is NOT created
 * (returns false), because that would invent an item nobody asked for.
 */
export function setAt(root: Record<string, unknown>, path: string, value: unknown): boolean {
  const segs = splitPath(path);
  let cur: unknown = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (seg.startsWith("@")) {
      if (!Array.isArray(cur)) return false;
      const found = cur.find((x) => x && (x as { id: string }).id === seg.slice(1));
      if (!found) return false;
      cur = found;
    } else {
      const obj = cur as Record<string, unknown>;
      if (obj[seg] === undefined || obj[seg] === null || typeof obj[seg] !== "object") obj[seg] = {};
      cur = obj[seg];
    }
  }
  const last = segs[segs.length - 1];
  if (last === ORDER || last.startsWith("@")) return false;
  if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return false;
  if (value === undefined) delete (cur as Record<string, unknown>)[last];
  else (cur as Record<string, unknown>)[last] = value;
  return true;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** JSON with sorted keys – used to compare two contents regardless of key order. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const keys = Object.keys(v as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
