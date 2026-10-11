/**
 * Business operations. Every function checks permissions first, does its work inside a
 * database transaction where several rows change together, and writes an audit entry.
 */
import fs from "node:fs";
import path from "node:path";
import { BulkTarget, planBulkChange, targetLabel, type BulkPlan, type BulkSite } from "@/lib/bulk";
import { buildPackage, copyChecklist, parsePackage, prepareCopy, SLUG_RE, slugify } from "@/lib/clone";
import { applySelected, diffContent, summarizeChanges, summaryLine, type DisplayChange } from "@/lib/content/diff";
import { applyOps, mergeEdits, type Conflict } from "@/lib/content/merge";
import { describePath } from "@/lib/content/describe";
import { flatten } from "@/lib/content/paths";
import type { EditOp, SiteContent } from "@/lib/content/types";
import { validateForPublish, validateGaId, validateGtmId, type Issue } from "@/lib/content/validate";
import { toCsv } from "@/lib/i18n/csv";
import { parseTranslationFile, planImport, type ImportPlan } from "@/lib/i18n/import";
import { formatLanguageList, languageInfo, languageName } from "@/lib/i18n/languages";
import { can, PermissionError, ROLE_LABELS, visibleClientIds, type Action, type Actor, type Role } from "@/lib/permissions";
import { db, newId, UPLOAD_DIR } from "./db";
import { hashPassword } from "./password";
import * as repo from "./repo";

// ---------- helpers ----------

export function requireSite(actor: Actor, siteId: string, action: Action): repo.SiteRow {
  const site = repo.getSite(siteId);
  if (!site || !can(actor, "site.view", site.client_id)) throw new PermissionError("This website does not exist or you do not have access to it.");
  if (!can(actor, action, site.client_id)) throw new PermissionError();
  return site;
}

export function visibleSites(actor: Actor, workspaceId: string): repo.SiteRow[] {
  const clients = repo.listClients(workspaceId).map((c) => c.id);
  return repo.listSitesForClients(visibleClientIds(actor, clients));
}

function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}

/** Changes waiting to go live: the difference between the live website and the draft. */
export function pendingChanges(site: repo.SiteRow): { changes: DisplayChange[]; live: SiteContent | null; draft: SiteContent; revision: number } {
  const { content: draft, revision } = repo.getDraft(site.id);
  const live = repo.getLiveRelease(site)?.content ?? null;
  if (!live) return { changes: [], live: null, draft, revision };
  return { changes: summarizeChanges(diffContent(live, draft), live, draft), live, draft, revision };
}

// ---------- editing ----------

export type SaveResult =
  | { ok: true; revision: number; content: SiteContent; mergedWithOthers: number; skipped: number }
  | { ok: false; conflicts: Conflict[]; revision: number; content: SiteContent; byWhom: string };

export function saveDraft(actor: Actor, siteId: string, baseRevision: number, ops: EditOp[], summary?: string): SaveResult {
  const site = requireSite(actor, siteId, "site.edit");
  return tx(() => {
    const current = repo.getDraft(site.id);
    const base = repo.getDraftAt(site.id, baseRevision) ?? current.content;
    const merged = baseRevision === current.revision ? { ok: true as const, content: applyOps(current.content, ops).content, mergedWithOthers: 0 } : mergeEdits(base, current.content, ops);
    if (!merged.ok) {
      const revs = repo.listDraftRevisions(site.id, 50).filter((r) => r.revision > baseRevision);
      const names = [...new Set(revs.map((r) => repo.userName(r.author_id)))];
      return { ok: false, conflicts: merged.conflicts, revision: current.revision, content: current.content, byWhom: names.join(", ") || "a colleague" };
    }
    const changes = summarizeChanges(diffContent(current.content, merged.content), current.content, merged.content);
    if (!changes.length) return { ok: true, revision: current.revision, content: current.content, mergedWithOthers: merged.mergedWithOthers, skipped: 0 };
    const text = summary ?? summaryLine(changes);
    const revision = repo.writeDraft(site.id, merged.content, actor.id, text);
    repo.audit(actor.id, site, "draft.save", text);
    return { ok: true, revision, content: merged.content, mergedWithOthers: merged.mergedWithOthers, skipped: 0 };
  });
}

export function requestReview(actor: Actor, siteId: string, note: string) {
  const site = requireSite(actor, siteId, "site.requestReview");
  repo.updateSite(site.id, { review_state: "ready", review_requested_by: actor.id, review_requested_at: new Date().toISOString(), review_note: note.trim() || null });
  repo.audit(actor.id, site, "review.request", note.trim() ? `Sent for review: “${note.trim()}”` : "Sent for review");
}

export function cancelReview(actor: Actor, siteId: string) {
  const site = requireSite(actor, siteId, "site.requestReview");
  repo.updateSite(site.id, { review_state: "editing", review_requested_by: null, review_requested_at: null, review_note: null });
  repo.audit(actor.id, site, "review.cancel", "Review request withdrawn");
}

// ---------- publishing ----------

export type PublishResult =
  | { ok: true; releaseNumber: number; summary: string }
  | { ok: false; kind: "blocked"; issues: Issue[] }
  | { ok: false; kind: "failed"; error: repo.ReleaseError; releaseId: string }
  | { ok: false; kind: "nothing"; message: string };

interface PublishOptions {
  /** Raw paths to publish. Undefined = everything in the draft. */
  paths?: string[];
  note?: string;
  source?: "publish" | "restore" | "bulk" | "backup";
  changeSetId?: string | null;
  /** Content to publish directly (restore). */
  content?: SiteContent;
  summaryOverride?: string;
}

/**
 * The launch pipeline: build the next live version, check it, back up, "deploy".
 * If any step fails, the live website keeps showing the previous version.
 */
export function publishSite(actor: Actor, siteId: string, opts: PublishOptions = {}): PublishResult {
  const site = requireSite(actor, siteId, opts.source === "restore" || opts.source === "backup" ? "site.restore" : "site.publish");
  return tx(() => {
    const { content: draft } = repo.getDraft(site.id);
    const liveRelease = repo.getLiveRelease(site);
    const live = liveRelease?.content ?? null;

    let next: SiteContent;
    if (opts.content) next = opts.content;
    else if (!live || !opts.paths) next = draft;
    else next = applySelected(live, draft, opts.paths);

    const changes = live ? summarizeChanges(diffContent(live, next), live, next) : [];
    if (live && changes.length === 0) return { ok: false, kind: "nothing", message: "There is nothing new to publish – the live website already shows this content." };

    // Step 1: content checks (block before anything happens).
    const errors = validateForPublish(next).filter((i) => i.severity === "error");
    if (errors.length) return { ok: false, kind: "blocked", issues: errors };

    const summary = opts.summaryOverride ?? (live ? summaryLine(changes) : `First launch in ${formatLanguageList(next.settings.languages.filter((l) => l.public).map((l) => l.id))}`);

    // Step 2: hosting / deployment. Failures here are recorded and the live site is untouched.
    const failure = deployCheck(site, next);
    if (failure) {
      const releaseId = newId("rel");
      repo.insertRelease({ id: releaseId, site_id: site.id, number: null, status: "failed", snapshot: JSON.stringify(next), changes: JSON.stringify(changes), summary, note: opts.note ?? "", source: opts.source ?? "publish", change_set_id: opts.changeSetId ?? null, error: JSON.stringify(failure), author_id: actor.id });
      if (site.simulate_failure) repo.updateSite(site.id, { simulate_failure: 0 });
      repo.audit(actor.id, site, "launch.failed", `${failure.whatHappened} Live website unchanged${liveRelease ? ` (still version ${liveRelease.number})` : ""}.`);
      return { ok: false, kind: "failed", error: failure, releaseId };
    }

    // Step 3: automatic backup of what is live now, then switch.
    if (live) {
      repo.insertBackup({ site_id: site.id, label: `Automatic backup before version ${repo.nextReleaseNumber(site.id)}`, kind: "automatic", draft_snapshot: JSON.stringify(draft), live_snapshot: JSON.stringify(live), live_release_number: liveRelease!.number, created_by: actor.id });
    }
    const number = repo.nextReleaseNumber(site.id);
    const releaseId = newId("rel");
    db().prepare("UPDATE releases SET status = 'previous' WHERE site_id = ? AND status = 'live'").run(site.id);
    repo.insertRelease({ id: releaseId, site_id: site.id, number, status: "live", snapshot: JSON.stringify(next), changes: JSON.stringify(changes), summary, note: opts.note ?? "", source: opts.source ?? "publish", change_set_id: opts.changeSetId ?? null, error: null, author_id: actor.id });
    repo.updateSite(site.id, { live_release_id: releaseId });

    // Nothing left to review? Clear the review request.
    const remaining = diffContent(next, draft).length;
    if (remaining === 0) repo.updateSite(site.id, { review_state: "editing", review_requested_by: null, review_requested_at: null, review_note: null });
    repo.audit(actor.id, site, "launch.success", `Version ${number} is live: ${summary}`);
    return { ok: true, releaseNumber: number, summary };
  });
}

/** Simulated hosting step. Real deployment would upload files / invalidate a CDN here. */
function deployCheck(site: repo.SiteRow, next: SiteContent): repo.ReleaseError | null {
  if (site.simulate_failure) {
    return {
      step: "Uploading to the web host",
      whatHappened: "The web host did not respond in time (simulated outage for the demo).",
      whatToDo: "Nothing was lost and visitors still see the previous version. Wait a few minutes and press “Try again”. If it fails again, contact the hosting provider.",
    };
  }
  const images = Object.values(flatten(next)).filter((v): v is string => typeof v === "string" && v.startsWith("/media/"));
  // Where uploads sit on a per-instance temporary disk, the instance running this check is often
  // not the one that stored the file, so its absence says nothing about the picture really being
  // gone and would fail launches that are fine. Only a durable disk can answer this.
  const storageIsDurable = !process.env.VERCEL;
  const missing = storageIsDurable
    ? images.filter((src) => !fs.existsSync(path.join(UPLOAD_DIR, path.basename(src))))
    : [];
  if (missing.length) {
    return {
      step: "Preparing pictures",
      whatHappened: `${missing.length} uploaded picture${missing.length === 1 ? " is" : "s are"} missing from storage (${missing.map((m) => path.basename(m)).join(", ")}).`,
      whatToDo: "Open the editor, choose the picture again, save, and launch again. Visitors still see the previous version.",
    };
  }
  return null;
}

// ---------- history & restore ----------

export function restorePreview(actor: Actor, siteId: string, releaseId: string) {
  const site = requireSite(actor, siteId, "site.view");
  const target = repo.getRelease(releaseId);
  const live = repo.getLiveRelease(site);
  if (!target || target.site_id !== site.id || !live) return null;
  return { target, live, changes: summarizeChanges(diffContent(live.content, target.content), live.content, target.content) };
}

/**
 * Go back to an earlier version. The old content is published as a NEW version (history is never
 * deleted), and the same fields are reverted in the draft so the mistake is not re-published later.
 * Unrelated unpublished work in the draft is kept.
 */
export function restoreRelease(actor: Actor, siteId: string, releaseId: string, note: string): PublishResult {
  const site = requireSite(actor, siteId, "site.restore");
  const preview = restorePreview(actor, siteId, releaseId);
  if (!preview) return { ok: false, kind: "nothing", message: "That version could not be found." };
  const res = publishSite(actor, siteId, { content: preview.target.content, source: "restore", note, summaryOverride: `Went back to the content of version ${preview.target.number} (published ${preview.target.created_at.slice(0, 10)} by ${preview.target.authorName})` });
  if (res.ok) {
    const { content: draft, revision } = repo.getDraft(site.id);
    const paths = diffContent(preview.live.content, preview.target.content).map((c) => c.path);
    const revertedDraft = applySelected(draft, preview.target.content, paths);
    if (diffContent(draft, revertedDraft).length) saveDraft(actor, siteId, revision, opsFromContent(draft, revertedDraft), `Draft updated to match restored version ${preview.target.number}`);
  }
  return res;
}

/** Express "make `from` look like `to`" as edit operations (used to update drafts safely). */
function opsFromContent(from: SiteContent, to: SiteContent): EditOp[] {
  // Replace whole top-level sections that differ – simple and exact.
  const ops: EditOp[] = [];
  const a = from as unknown as Record<string, Record<string, unknown>>;
  const b = to as unknown as Record<string, Record<string, unknown>>;
  for (const section of Object.keys(b)) {
    if (JSON.stringify(a[section]) === JSON.stringify(b[section])) continue;
    for (const ch of diffContent(a[section], b[section])) {
      if (ch.path.includes("__order") || ch.path.includes("@")) {
        // List structure changed: fall back to replacing list items one by one.
        continue;
      }
      ops.push({ op: "set", path: `${section}.${ch.path}`, value: (ch.after ?? "") as string });
    }
  }
  // Lists: rebuild via add/remove/move so concurrent edits elsewhere still merge.
  const lists: Array<[string, Array<{ id: string }>, Array<{ id: string }>]> = [
    ["categories.items", from.categories.items, to.categories.items],
    ["offers.items", from.offers.items, to.offers.items],
    ["settings.languages", from.settings.languages, to.settings.languages],
  ];
  for (const [list, before, after] of lists) {
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    for (const item of before) if (!after.some((x) => x.id === item.id)) ops.push({ op: "removeItem", list, id: item.id });
    for (const item of after) {
      const old = before.find((x) => x.id === item.id);
      if (!old) ops.push({ op: "addItem", list, item: item as { id: string } & Record<string, unknown> });
      else for (const ch of diffContent(old, item)) ops.push({ op: "set", path: `${list}.@${item.id}.${ch.path}`, value: (ch.after ?? "") as string });
    }
    after.forEach((item, idx) => ops.push({ op: "moveItem", list, id: item.id, toIndex: idx }));
  }
  return ops;
}

// ---------- backups ----------

export function createBackup(actor: Actor, siteId: string, label: string) {
  const site = requireSite(actor, siteId, "site.backup");
  const { content: draft } = repo.getDraft(site.id);
  const live = repo.getLiveRelease(site);
  repo.insertBackup({ site_id: site.id, label: label.trim() || `Manual backup`, kind: "manual", draft_snapshot: JSON.stringify(draft), live_snapshot: live ? JSON.stringify(live.content) : null, live_release_number: live?.number ?? null, created_by: actor.id });
  repo.audit(actor.id, site, "backup.create", `Backup created: ${label.trim() || "Manual backup"}`);
}

export function backupRestorePreview(actor: Actor, siteId: string, backupId: string) {
  const site = requireSite(actor, siteId, "site.view");
  const b = repo.getBackup(backupId);
  if (!b || b.site_id !== site.id) return null;
  const { content: draft } = repo.getDraft(site.id);
  const live = repo.getLiveRelease(site);
  const backupDraft = JSON.parse(b.draft_snapshot) as SiteContent;
  const backupLive = b.live_snapshot ? (JSON.parse(b.live_snapshot) as SiteContent) : null;
  return {
    backup: b,
    liveChanges: live && backupLive ? summarizeChanges(diffContent(live.content, backupLive), live.content, backupLive) : [],
    draftChanges: summarizeChanges(diffContent(draft, backupDraft), draft, backupDraft),
    liveNumber: live?.number ?? null,
    backupHasLive: Boolean(backupLive),
  };
}

export function restoreBackup(actor: Actor, siteId: string, backupId: string): PublishResult | { ok: true; releaseNumber: null; summary: string } {
  const site = requireSite(actor, siteId, "site.restore");
  const b = repo.getBackup(backupId);
  if (!b || b.site_id !== site.id) return { ok: false, kind: "nothing", message: "That backup could not be found." };
  // Safety net: back up the current state first, so the restore itself can be undone.
  createBackupUnchecked(actor, site, `Safety backup before restoring “${b.label}”`, "safety");
  const backupLive = b.live_snapshot ? (JSON.parse(b.live_snapshot) as SiteContent) : null;
  let result: PublishResult | { ok: true; releaseNumber: null; summary: string } = { ok: true, releaseNumber: null, summary: "Draft restored" };
  if (backupLive) {
    const live = repo.getLiveRelease(site);
    const same = live && diffContent(live.content, backupLive).length === 0;
    if (!same) {
      result = publishSite(actor, siteId, { content: backupLive, source: "backup", summaryOverride: `Restored from backup “${b.label}”` });
      if (!result.ok) return result;
    }
  }
  const { content: draft, revision } = repo.getDraft(site.id);
  const backupDraft = JSON.parse(b.draft_snapshot) as SiteContent;
  if (diffContent(draft, backupDraft).length) {
    tx(() => {
      repo.writeDraft(site.id, backupDraft, actor.id, `Draft restored from backup “${b.label}”`);
    });
    void revision;
  }
  repo.audit(actor.id, site, "backup.restore", `Website restored from backup “${b.label}”`);
  return result;
}

function createBackupUnchecked(actor: Actor, site: repo.SiteRow, label: string, kind: string) {
  const { content: draft } = repo.getDraft(site.id);
  const live = repo.getLiveRelease(site);
  repo.insertBackup({ site_id: site.id, label, kind, draft_snapshot: JSON.stringify(draft), live_snapshot: live ? JSON.stringify(live.content) : null, live_release_number: live?.number ?? null, created_by: actor.id });
}

// ---------- new campaigns (copy a website) ----------

export function uniqueSlug(base: string): string {
  let slug = slugify(base);
  let i = 2;
  while (repo.getSiteBySlug(slug)) slug = `${slugify(base)}-${i++}`;
  return slug;
}

export function copySite(actor: Actor, sourceId: string, input: { name: string; slug: string; clientId?: string; newClientName?: string; workspaceId: string }): { ok: true; siteId: string } | { ok: false; error: string } {
  const source = requireSite(actor, sourceId, "site.view");
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Please give the new website a name." };
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { ok: false, error: "The web address can only contain lowercase letters, numbers and dashes (e.g. misty-mountain-retreats)." };
  if (repo.getSiteBySlug(slug)) return { ok: false, error: `The web address “${slug}” is already used by another website. Try “${uniqueSlug(slug)}”.` };

  let clientId = input.clientId;
  if (input.newClientName?.trim()) {
    if (!actor.isAdmin) return { ok: false, error: "Only an operations admin can add a new client." };
  } else if (!clientId || !can(actor, "site.create", clientId)) {
    return { ok: false, error: "You can only create websites for clients you publish for." };
  }
  return tx(() => {
    if (input.newClientName?.trim()) clientId = repo.createClient(input.workspaceId, input.newClientName.trim()).id;
    const { content } = repo.getDraft(source.id);
    const copy = prepareCopy(content, name);
    const id = newId("site");
    repo.insertSite({ id, client_id: clientId!, name, slug, copied_from: source.id, show_checklist: 1 }, copy, actor.id, `Copied from “${source.name}” (private client details removed)`);
    repo.audit(actor.id, { id, client_id: clientId! }, "site.copy", `Created “${name}” as a copy of “${source.name}”. Contact details, analytics IDs, enquiries and history were not copied.`);
    return { ok: true as const, siteId: id };
  });
}

export function checklistFor(site: repo.SiteRow, draft: SiteContent) {
  return copyChecklist(draft, JSON.parse(site.checklist) as string[], site.id);
}

export function tickChecklist(actor: Actor, siteId: string, itemId: string, done: boolean) {
  const site = requireSite(actor, siteId, "site.edit");
  const ticked = new Set(JSON.parse(site.checklist) as string[]);
  if (done) ticked.add(itemId);
  else ticked.delete(itemId);
  repo.updateSite(site.id, { checklist: JSON.stringify([...ticked]) });
}

// ---------- languages ----------

export function addLanguage(actor: Actor, siteId: string, code: string): SaveResult | { ok: false; error: string } {
  const site = requireSite(actor, siteId, "site.edit");
  const c = code.trim().toLowerCase();
  if (!/^[a-z]{2,3}(-[a-z]{2})?$/.test(c)) return { ok: false, error: "Choose a language from the list." };
  const { content, revision } = repo.getDraft(site.id);
  if (content.settings.languages.some((l) => l.id === c)) return { ok: false, error: `${languageName(c)} is already on this website.` };
  return saveDraft(actor, siteId, revision, [{ op: "addItem", list: "settings.languages", item: { id: c, public: false } }], `Added ${languageInfo(c).name} (hidden until ready)`);
}

export function setLanguageVisibility(actor: Actor, siteId: string, code: string, visible: boolean): SaveResult {
  const site = requireSite(actor, siteId, "site.edit");
  const { revision } = repo.getDraft(site.id);
  return saveDraft(actor, siteId, revision, [{ op: "set", path: `settings.languages.@${code}.public`, value: visible }], `${languageName(code)} ${visible ? "set to visible" : "set to hidden"} (takes effect when published)`);
}

export function translationImportPlan(actor: Actor, siteId: string, text: string, fileName: string, targetLocale?: string): { ok: true; plan: ImportPlan } | { ok: false; error: string } {
  const site = requireSite(actor, siteId, "site.edit");
  const { content } = repo.getDraft(site.id);
  const parsed = parseTranslationFile(text, fileName, content.settings.defaultLanguage, targetLocale);
  if (parsed.error) return { ok: false, error: parsed.error };
  return { ok: true, plan: planImport(content, parsed.entries) };
}

export function applyTranslationImport(actor: Actor, siteId: string, text: string, fileName: string, targetLocale: string | undefined, expectedCount: number) {
  const res = translationImportPlan(actor, siteId, text, fileName, targetLocale);
  if (!res.ok) return res;
  if (res.plan.ops.length !== expectedCount) return { ok: false as const, error: "The website changed while you were reviewing the import. Please check the preview again." };
  const { revision } = repo.getDraft(siteId);
  const langs = formatLanguageList([...new Set(res.plan.matches.map((m) => m.locale))]);
  const saved = saveDraft(actor, siteId, revision, res.plan.ops, `Imported ${res.plan.ops.length} ${langs} translation${res.plan.ops.length === 1 ? "" : "s"} from ${fileName}`);
  return saved.ok ? { ok: true as const, count: res.plan.ops.length } : { ok: false as const, error: "Someone changed the same texts at the same time. Please check the preview again." };
}

// ---------- settings ----------

export function updateSiteSettings(actor: Actor, siteId: string, input: { name: string; slug: string; notes: string; gaId: string; gtmId: string }): { ok: true } | { ok: false; error: string } {
  const site = requireSite(actor, siteId, "site.settings");
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!name) return { ok: false, error: "The website name cannot be empty." };
  if (!SLUG_RE.test(slug)) return { ok: false, error: "The web address can only contain lowercase letters, numbers and dashes." };
  const other = repo.getSiteBySlug(slug);
  if (other && other.id !== site.id) return { ok: false, error: `The web address “${slug}” is already used by “${other.name}”.` };
  const ga = input.gaId.trim().toUpperCase();
  const gtm = input.gtmId.trim().toUpperCase();
  const gaErr = validateGaId(ga) ?? validateGtmId(gtm);
  if (gaErr) return { ok: false, error: gaErr };
  return tx(() => {
    if (name !== site.name || slug !== site.slug || input.notes !== site.notes) {
      repo.updateSite(site.id, { name, slug, notes: input.notes });
      repo.audit(actor.id, site, "settings.update", slug !== site.slug ? `Web address changed from /s/${site.slug} to /s/${slug}` : "Website details updated");
    }
    const { content, revision } = repo.getDraft(site.id);
    const ops: EditOp[] = [];
    if (content.settings.gaId !== ga) ops.push({ op: "set", path: "settings.gaId", value: ga });
    if (content.settings.gtmId !== gtm) ops.push({ op: "set", path: "settings.gtmId", value: gtm });
    if (ops.length) saveDraft(actor, siteId, revision, ops, "Analytics IDs updated (takes effect when published)");
    return { ok: true as const };
  });
}

export function setSimulateFailure(actor: Actor, siteId: string, on: boolean) {
  const site = requireSite(actor, siteId, "site.settings");
  repo.updateSite(site.id, { simulate_failure: on ? 1 : 0 });
  repo.audit(actor.id, site, "demo.simulate", on ? "Demo: the next launch will fail (simulated hosting outage)" : "Demo: failure simulation switched off");
}

// ---------- bulk updates ----------

export function bulkSites(actor: Actor, workspaceId: string): BulkSite[] {
  return visibleSites(actor, workspaceId).map((s) => ({ id: s.id, name: s.name, content: repo.getDraft(s.id).content }));
}

export function planBulk(actor: Actor, workspaceId: string, target: BulkTarget, siteIds: string[], locales: string[], value: string | Record<string, string>): BulkPlan {
  return planBulkChange(bulkSites(actor, workspaceId), target, siteIds, locales, value);
}

export interface BulkApplyResult {
  siteId: string;
  siteName: string;
  saved: boolean;
  published: boolean | null;
  message: string;
}

export function applyBulk(
  actor: Actor,
  workspaceId: string,
  input: { target: BulkTarget; siteIds: string[]; locales: string[]; value: string | Record<string, string>; publishNow: boolean; note: string; expected: string[] },
): { ok: true; results: BulkApplyResult[]; changeSetId: string } | { ok: false; error: string } {
  const plan = planBulk(actor, workspaceId, input.target, input.siteIds, input.locales, input.value);
  // The plan must still match what the person reviewed (nobody changed those values meanwhile).
  const fingerprint = plan.changes.map((c) => `${c.siteId}|${c.path}|${c.before}`).sort();
  if (JSON.stringify(fingerprint) !== JSON.stringify([...input.expected].sort())) {
    return { ok: false, error: "Some of these values were changed by someone else while you were reviewing. Please check the preview again." };
  }
  if (!plan.changes.length) return { ok: false, error: "There is nothing to change." };
  for (const siteId of Object.keys(plan.opsBySite)) {
    const site = requireSite(actor, siteId, input.publishNow ? "site.publish" : "site.edit");
    void site;
  }
  const title = `Bulk update: ${targetLabel(input.target)}${input.locales.length ? ` (${formatLanguageList(input.locales)})` : ""}`;
  const changeSetId = repo.insertChangeSet(title, actor.id, { target: input.target, siteIds: input.siteIds, locales: input.locales, value: input.value, changes: plan.changes });
  const results: BulkApplyResult[] = [];
  for (const [siteId, ops] of Object.entries(plan.opsBySite)) {
    const site = repo.getSite(siteId)!;
    const { revision } = repo.getDraft(siteId);
    const saved = saveDraft(actor, siteId, revision, ops, title);
    if (!saved.ok) {
      results.push({ siteId, siteName: site.name, saved: false, published: null, message: "Not changed: someone edited the same text at the same time." });
      continue;
    }
    if (!input.publishNow) {
      results.push({ siteId, siteName: site.name, saved: true, published: null, message: "Saved to draft – not live yet." });
      continue;
    }
    // Publish ONLY the bulk-changed values – other unpublished work on that website stays in draft.
    const pub = publishSite(actor, siteId, { paths: ops.map((o) => (o as { path: string }).path), source: "bulk", changeSetId, note: input.note, summaryOverride: title });
    if (pub.ok) results.push({ siteId, siteName: site.name, saved: true, published: true, message: `Live now as version ${pub.releaseNumber}.` });
    else if (pub.kind === "blocked") results.push({ siteId, siteName: site.name, saved: true, published: false, message: `Saved to draft but not published: ${pub.issues[0].message}` });
    else if (pub.kind === "failed") results.push({ siteId, siteName: site.name, saved: true, published: false, message: `Saved to draft but the launch failed: ${pub.error.whatHappened} The live website is unchanged.` });
    else results.push({ siteId, siteName: site.name, saved: true, published: false, message: pub.message });
  }
  return { ok: true, results, changeSetId };
}

// ---------- transfer between workspaces ----------

/** A plain picture file name and nothing else – no directories, no other kinds of file. */
const MEDIA_NAME_RE = /^[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif|svg)$/i;
/** The same ceiling an upload has, so a package cannot smuggle in something larger. */
const MAX_PACKAGE_FILE = 6 * 1024 * 1024;

/** The uploaded pictures a package needs, as file name → base64. */
function readPackageFiles(contents: Array<SiteContent | null>): Record<string, string> {
  const names = new Set<string>();
  for (const content of contents) {
    if (!content) continue;
    for (const value of Object.values(flatten(content))) {
      if (typeof value === "string" && value.startsWith("/media/")) names.add(path.basename(value));
    }
  }
  const out: Record<string, string> = {};
  for (const name of names) {
    if (!MEDIA_NAME_RE.test(name)) continue;
    try {
      const bytes = fs.readFileSync(path.join(UPLOAD_DIR, name));
      if (bytes.byteLength <= MAX_PACKAGE_FILE) out[name] = bytes.toString("base64");
    } catch {
      // Not on this disk. The website still imports; that picture arrives as a placeholder.
    }
  }
  return out;
}

/**
 * Writes the pictures that came with a package.
 *
 * The names come from a file someone uploaded, so each one has to be a plain picture file name –
 * anything carrying a directory, or any other kind of file, is ignored rather than trusted. An
 * existing file is never overwritten: names are UUIDs, so a match is already the same picture.
 */
function writePackageFiles(files: Record<string, string> | undefined) {
  if (!files) return;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const [givenName, base64] of Object.entries(files)) {
    if (givenName !== path.basename(givenName) || !MEDIA_NAME_RE.test(givenName)) continue;
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.byteLength || bytes.byteLength > MAX_PACKAGE_FILE) continue;
    const full = path.join(UPLOAD_DIR, givenName);
    if (!fs.existsSync(full)) fs.writeFileSync(full, bytes);
  }
}

export function exportPackage(actor: Actor, siteId: string, opts: { includeContact: boolean; includeAnalytics: boolean }) {
  const site = requireSite(actor, siteId, "site.transfer");
  const { content: draft } = repo.getDraft(site.id);
  const live = repo.getLiveRelease(site)?.content ?? null;
  repo.audit(actor.id, site, "transfer.export", `Website package downloaded${opts.includeContact ? " (with contact details)" : ""}`);
  const pkg = buildPackage({ name: site.name, slug: site.slug }, draft, live, opts, readPackageFiles([draft, live]));
  return { fileName: `${site.slug}.sitedesk.json`, json: JSON.stringify(pkg, null, 2) };
}

export function importPackage(actor: Actor, text: string, target: { workspaceId: string; clientId?: string; newClientName?: string }): { ok: true; siteId: string; name: string } | { ok: false; error: string } {
  if (!can(actor, "site.transfer")) throw new PermissionError();
  const parsed = parsePackage(text);
  if (!parsed.ok) return parsed;
  const { pkg } = parsed;
  // Before the transaction: the pictures are files, so they are not part of it, and a website
  // whose import then fails only leaves unreferenced bytes behind.
  writePackageFiles(pkg.files);
  return tx(() => {
    let clientId = target.clientId;
    if (target.newClientName?.trim()) clientId = repo.createClient(target.workspaceId, target.newClientName.trim()).id;
    const client = clientId ? repo.getClient(clientId) : undefined;
    if (!client || client.workspace_id !== target.workspaceId) return { ok: false as const, error: "Choose a client in this workspace." };
    const id = newId("site");
    const slug = uniqueSlug(pkg.site.slug);
    repo.insertSite({ id, client_id: client.id, name: pkg.site.name, slug, show_checklist: 0 }, pkg.draft, actor.id, `Imported from a website package (exported ${pkg.exportedAt.slice(0, 10)})`);
    repo.audit(actor.id, { id, client_id: client.id }, "transfer.import", `Imported “${pkg.site.name}” from a website package. It is not live until someone publishes it.`);
    if (pkg.live) {
      repo.insertBackup({ site_id: id, label: "Live version from the original workspace", kind: "imported", draft_snapshot: JSON.stringify(pkg.draft), live_snapshot: JSON.stringify(pkg.live), live_release_number: null, created_by: actor.id });
    }
    return { ok: true as const, siteId: id, name: pkg.site.name };
  });
}

// ---------- public enquiries ----------

export function submitLead(slug: string, input: { name: string; email: string; message: string; locale: string; website: string }): { ok: boolean; error?: string } {
  const site = repo.getSiteBySlug(slug);
  if (!site || !site.live_release_id) return { ok: false, error: "Not found" };
  if (input.website) return { ok: true }; // honeypot: bots fill hidden fields
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().slice(0, 200);
  const message = input.message.trim().slice(0, 4000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) return { ok: false, error: "Please fill in your name, a valid email and a message." };
  repo.insertLead(site.id, { name, email, message, locale: input.locale });
  return { ok: true };
}

export function siteSummary(actor: Actor, site: repo.SiteRow) {
  const { changes, draft, live } = pendingChanges(site);
  const liveRelease = repo.getLiveRelease(site);
  const lastFailed = repo.listReleases(site.id).find((r) => r.status === "failed");
  const failedAfterLive = lastFailed && (!liveRelease || lastFailed.created_at > liveRelease.created_at) ? lastFailed : null;
  return { site, draft, live, changes, liveRelease, failedAfterLive, client: repo.getClient(site.client_id)!, canPublish: can(actor, "site.publish", site.client_id) };
}

// ---------- team & access ----------

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  title: string;
  isAdmin: boolean;
  isYou: boolean;
  /** clientId → role, only for clients in the current workspace. */
  roles: Array<{ clientId: string; clientName: string; role: Role }>;
}

/** Everyone, with the clients of this workspace they can work on. Admins only. */
export function listTeam(actor: Actor, workspaceId: string): { members: TeamMember[]; clients: repo.ClientRow[] } {
  if (!can(actor, "team.manage")) throw new PermissionError("Only an operations admin can manage people and access.");
  const clients = repo.listClients(workspaceId);
  const byId = new Map(clients.map((c) => [c.id, c.name]));
  const members = repo.listUsers().map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    isAdmin: Boolean(u.is_admin),
    isYou: u.id === actor.id,
    roles: repo
      .membershipsFor(u.id)
      .filter((m) => byId.has(m.client_id))
      .map((m) => ({ clientId: m.client_id, clientName: m.client, role: m.role })),
  }));
  return { members, clients };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function addPerson(
  actor: Actor,
  input: { name: string; email: string; title: string; password: string; isAdmin: boolean },
): { ok: true; userId: string } | { ok: false; error: string } {
  if (!can(actor, "team.manage")) throw new PermissionError("Only an operations admin can add people.");
  const name = input.name.trim();
  const email = input.email.trim();
  const title = input.title.trim() || "Team member";
  if (!name) return { ok: false, error: "Enter the person’s name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address – this is what they sign in with." };
  if (input.password.length < 8) return { ok: false, error: "The first password must be at least 8 characters. They can be told it privately." };
  if (repo.getUserByEmail(email)) return { ok: false, error: `Somebody already uses ${email}. Give the new person their own email address.` };
  return tx(() => {
    const u = repo.createUser({ name, email, title, passwordHash: hashPassword(input.password), isAdmin: input.isAdmin });
    repo.audit(actor.id, null, "team.add", `Added ${name} (${email})${input.isAdmin ? " as an operations admin" : ""}. No client access yet.`);
    return { ok: true as const, userId: u.id };
  });
}

/** Give somebody a role on a client, change it, or take the access away (`role: null`). */
export function setClientAccess(actor: Actor, userId: string, clientId: string, role: Role | null): { ok: true } | { ok: false; error: string } {
  if (!can(actor, "team.manage")) throw new PermissionError("Only an operations admin can change who works on a client.");
  const user = repo.getUser(userId);
  const client = repo.getClient(clientId);
  if (!user || !client) return { ok: false, error: "That person or client no longer exists." };
  return tx(() => {
    if (role) {
      repo.setMembership(userId, clientId, role);
      repo.audit(actor.id, { client_id: clientId }, "team.access", `${user.name} can now work on ${client.name} as ${ROLE_LABELS[role].name.toLowerCase()}.`);
    } else {
      repo.removeMembership(userId, clientId);
      repo.audit(actor.id, { client_id: clientId }, "team.access", `${user.name} no longer has access to ${client.name}.`);
    }
    return { ok: true as const };
  });
}

/** Make somebody an operations admin, or take it away. The last admin cannot be removed. */
export function setAdmin(actor: Actor, userId: string, isAdmin: boolean): { ok: true } | { ok: false; error: string } {
  if (!can(actor, "team.manage")) throw new PermissionError("Only an operations admin can change admin rights.");
  const user = repo.getUser(userId);
  if (!user) return { ok: false, error: "That person no longer exists." };
  if (!isAdmin && repo.countAdmins() <= 1 && user.is_admin) {
    return { ok: false, error: "This is the only operations admin. Make somebody else an admin first, otherwise nobody could manage access." };
  }
  return tx(() => {
    repo.setUserAdmin(userId, isAdmin);
    repo.audit(actor.id, null, "team.access", isAdmin ? `${user.name} is now an operations admin (every client, every action).` : `${user.name} is no longer an operations admin.`);
    return { ok: true as const };
  });
}

// ---------- audit export ----------

/** The activity log for this workspace as a spreadsheet (CSV), for record keeping outside the app. */
export function activityCsv(actor: Actor, workspaceId: string): string {
  const sites = visibleSites(actor, workspaceId);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const clientName = new Map(repo.listClients(workspaceId).map((c) => [c.id, c.name]));
  const clientIds = visibleClientIds(actor, [...clientName.keys()]);
  const rows = repo.listAudit(clientIds, undefined, 5000, actor.isAdmin).map((a) => [
    a.at,
    repo.userName(a.user_id),
    a.action,
    a.client_id ? clientName.get(a.client_id) ?? "" : "",
    a.site_id ? siteName.get(a.site_id) ?? "" : "",
    a.detail,
  ]);
  return toCsv([["when", "who", "what", "client", "website", "details"], ...rows]);
}

// ---------- search ----------

export interface SearchHit {
  siteId: string;
  siteName: string;
  clientName: string;
  label: string;
  locale: string | null;
  snippet: string;
  link: string;
}

/** Find a phrase in the drafts of every website the person can see. Case-insensitive. */
export function searchContent(actor: Actor, workspaceId: string, query: string, limit = 60): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const clients = new Map(repo.listClients(workspaceId).map((c) => [c.id, c.name]));
  const hits: SearchHit[] = [];
  for (const site of visibleSites(actor, workspaceId)) {
    const { content } = repo.getDraft(site.id);
    for (const [path, value] of Object.entries(flatten(content))) {
      if (typeof value !== "string" || !value.toLowerCase().includes(q)) continue;
      if (path.startsWith("settings.")) continue;
      const described = describePath(path, content);
      hits.push({
        siteId: site.id,
        siteName: site.name,
        clientName: clients.get(site.client_id) ?? "",
        label: described.full,
        locale: described.language ?? null,
        snippet: snippetAround(value, q),
        link: `/app/sites/${site.id}/edit?section=${path.split(".")[0]}`,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

/** A short piece of the text around the match, so the person recognises where it is. */
function snippetAround(value: string, q: string): string {
  const at = value.toLowerCase().indexOf(q);
  if (value.length <= 120) return value;
  const start = Math.max(0, at - 40);
  return `${start > 0 ? "…" : ""}${value.slice(start, start + 120).trim()}${start + 120 < value.length ? "…" : ""}`;
}
