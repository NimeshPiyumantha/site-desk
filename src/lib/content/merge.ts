/**
 * Saving edits safely when two people work on the same website.
 *
 * Every save says which draft revision it started from ("base"). If someone else saved in the
 * meantime we compare: edits to different fields are combined automatically; edits to the SAME
 * field (or to an item someone removed) are returned as conflicts for a person to decide.
 * Nothing is ever silently overwritten.
 */
import { describePath, formatValue } from "./describe";
import { diffContent } from "./diff";
import { clone, getAt, itemPrefix, setAt } from "./paths";
import type { EditOp } from "./types";

export interface Conflict {
  path: string;
  label: string;
  yours: string;
  theirs: string;
  reason: "same-field" | "item-removed" | "item-edited";
}

export function applyOps<T>(content: T, ops: EditOp[]): { content: T; skipped: EditOp[] } {
  const next = clone(content) as unknown as Record<string, unknown>;
  const skipped: EditOp[] = [];
  for (const op of ops) {
    if (op.op === "set") {
      if (!setAt(next, op.path, op.value)) skipped.push(op);
    } else {
      const list = getAt(next, op.list);
      if (!Array.isArray(list)) {
        skipped.push(op);
        continue;
      }
      const arr = list as Array<{ id: string }>;
      if (op.op === "addItem") {
        if (arr.some((x) => x.id === op.item.id)) {
          skipped.push(op);
          continue;
        }
        const idx = op.index === undefined ? arr.length : Math.max(0, Math.min(op.index, arr.length));
        arr.splice(idx, 0, clone(op.item));
      } else if (op.op === "removeItem") {
        const idx = arr.findIndex((x) => x.id === op.id);
        if (idx === -1) skipped.push(op);
        else arr.splice(idx, 1);
      } else if (op.op === "moveItem") {
        const idx = arr.findIndex((x) => x.id === op.id);
        if (idx === -1) {
          skipped.push(op);
          continue;
        }
        const [item] = arr.splice(idx, 1);
        arr.splice(Math.max(0, Math.min(op.toIndex, arr.length)), 0, item);
      }
    }
  }
  return { content: next as unknown as T, skipped };
}

export type MergeResult<T> =
  | { ok: true; content: T; mergedWithOthers: number }
  | { ok: false; conflicts: Conflict[] };

/**
 * @param base     the draft the editor started from
 * @param current  the draft as it is now on the server
 * @param ops      the editor's changes
 */
export function mergeEdits<T>(base: T, current: T, ops: EditOp[]): MergeResult<T> {
  const changedByOthers = diffContent(base, current).map((c) => c.path);
  const changedSet = new Set(changedByOthers);
  const conflicts: Conflict[] = [];

  for (const op of ops) {
    if (op.op === "set") {
      const item = itemPrefix(op.path);
      if (item && getAt(current, item) === undefined && getAt(base, item) !== undefined) {
        conflicts.push({
          path: op.path,
          label: describePath(op.path, base).full,
          yours: formatValue(op.value),
          theirs: "(this item was removed by a colleague)",
          reason: "item-removed",
        });
        continue;
      }
      if (changedSet.has(op.path)) {
        const theirs = getAt(current, op.path);
        if (theirs !== op.value) {
          conflicts.push({
            path: op.path,
            label: describePath(op.path, current, base).full,
            yours: formatValue(op.value),
            theirs: formatValue(theirs),
            reason: "same-field",
          });
        }
      }
    } else if (op.op === "removeItem") {
      const prefix = `${op.list}.@${op.id}.`;
      const edited = changedByOthers.filter((p) => p.startsWith(prefix));
      if (edited.length > 0 && getAt(current, `${op.list}.@${op.id}`) !== undefined) {
        conflicts.push({
          path: `${op.list}.@${op.id}`,
          label: describePath(edited[0], current).full.split(" › ").slice(0, 2).join(" › "),
          yours: "Remove this item",
          theirs: `A colleague edited it (${edited.length} change${edited.length === 1 ? "" : "s"})`,
          reason: "item-edited",
        });
      }
    }
  }

  if (conflicts.length) return { ok: false, conflicts };
  const { content } = applyOps(current, ops);
  return { ok: true, content, mergedWithOthers: changedByOthers.length };
}
