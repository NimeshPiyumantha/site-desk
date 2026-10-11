"use server";
/**
 * Server actions called by the screens. Each one: who is signed in → service call → refresh pages.
 * Errors are returned as friendly messages instead of crashing the page.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BulkTarget } from "@/lib/bulk";
import type { EditOp } from "@/lib/content/types";
import { PermissionError } from "@/lib/permissions";
import { clearSession, requireUser, setSession, setWorkspace } from "./auth";
import { db, UPLOAD_DIR } from "./db";
import { verifyPassword } from "./password";
import * as repo from "./repo";
import * as svc from "./services";

type Fail = { ok: false; error: string };

async function guard<T>(fn: () => T | Promise<T>): Promise<T | Fail> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // Next.js redirects
    console.error(e);
    return { ok: false, error: "Something went wrong and nothing was changed. Please try again." };
  }
}

const refreshSite = (siteId: string) => {
  revalidatePath(`/app/sites/${siteId}`, "layout");
  revalidatePath("/app");
};

// ---------- sign in ----------

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  db();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const user = await repo.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return { error: "That email and password do not match. Demo password: demo1234" };
  await setSession(user.id);
  redirect("/app");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function switchWorkspaceAction(id: string) {
  const u = await requireUser();
  if (u.workspaces.some((w) => w.id === id)) await setWorkspace(id);
  revalidatePath("/app", "layout");
}

// ---------- editing ----------

export async function saveDraftAction(siteId: string, baseRevision: number, ops: EditOp[]) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.saveDraft(u.actor, siteId, baseRevision, ops);
    if (res.ok) refreshSite(siteId);
    return res;
  });
}

export async function heartbeatAction(siteId: string) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.requireSite(u.actor, siteId, "site.view");
    await repo.touchPresence(siteId, u.user.id);
    const site = (await repo.getSite(siteId))!;
    const last = (await repo.listDraftRevisions(siteId, 1))[0];
    return { ok: true as const, editors: (await repo.activeEditors(siteId, u.user.id)).map((e) => e.name), revision: site.draft_revision, lastBy: last?.author_id === u.user.id ? null : await repo.userName(last?.author_id ?? null) };
  });
}

export async function uploadImageAction(form: FormData): Promise<{ ok: true; url: string } | Fail> {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file was received." };
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" }[file.type];
  if (!ext) return { ok: false, error: "Please choose a JPG, PNG, WebP, GIF or SVG picture." };
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: "The picture is larger than 6 MB. Please choose a smaller one." };
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/media/${name}` };
}

// ---------- review & publish ----------

export async function requestReviewAction(siteId: string, note: string) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.requestReview(u.actor, siteId, note);
    refreshSite(siteId);
    return { ok: true as const };
  });
}

export async function cancelReviewAction(siteId: string) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.cancelReview(u.actor, siteId);
    refreshSite(siteId);
    return { ok: true as const };
  });
}

export async function publishAction(siteId: string, changeIds: string[] | "all", note: string) {
  const u = await requireUser();
  return await guard(async () => {
    const site = await svc.requireSite(u.actor, siteId, "site.publish");
    let paths: string[] | undefined;
    if (changeIds !== "all") {
      const { changes } = await svc.pendingChanges(site);
      const selected = changes.filter((c) => changeIds.includes(c.id));
      if (selected.length !== changeIds.length) return { ok: false as const, kind: "nothing" as const, message: "The draft changed while you were reviewing. Please check the list again." };
      if (!selected.length) return { ok: false as const, kind: "nothing" as const, message: "Select at least one change to publish." };
      paths = selected.flatMap((c) => c.paths);
    }
    const res = await svc.publishSite(u.actor, siteId, { paths, note });
    refreshSite(siteId);
    return res;
  });
}

export async function retryLaunchAction(siteId: string, releaseId: string) {
  const u = await requireUser();
  return await guard(async () => {
    const failed = await repo.getRelease(releaseId);
    if (!failed || failed.site_id !== siteId || failed.status !== "failed") return { ok: false as const, kind: "nothing" as const, message: "That launch could not be found." };
    const res = await svc.publishSite(u.actor, siteId, { content: failed.content, note: failed.note, source: failed.source as "publish", changeSetId: failed.change_set_id, summaryOverride: failed.summary });
    refreshSite(siteId);
    return res;
  });
}

export async function restoreReleaseAction(siteId: string, releaseId: string, note: string) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.restoreRelease(u.actor, siteId, releaseId, note);
    refreshSite(siteId);
    return res;
  });
}

// ---------- backups ----------

export async function createBackupAction(siteId: string, label: string) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.createBackup(u.actor, siteId, label);
    refreshSite(siteId);
    return { ok: true as const };
  });
}

export async function restoreBackupAction(siteId: string, backupId: string) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.restoreBackup(u.actor, siteId, backupId);
    refreshSite(siteId);
    return res;
  });
}

// ---------- new campaigns ----------

export async function copySiteAction(sourceId: string, input: { name: string; slug: string; clientId?: string; newClientName?: string }) {
  const u = await requireUser();
  const res = await guard(async () => await svc.copySite(u.actor, sourceId, { ...input, workspaceId: u.workspaceId }));
  if (res.ok) {
    revalidatePath("/app");
    redirect(`/app/sites/${res.siteId}?copied=1`);
  }
  return res;
}

export async function tickChecklistAction(siteId: string, itemId: string, done: boolean) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.tickChecklist(u.actor, siteId, itemId, done);
    refreshSite(siteId);
    return { ok: true as const };
  });
}

export async function hideChecklistAction(siteId: string) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.requireSite(u.actor, siteId, "site.edit");
    await repo.updateSite(siteId, { show_checklist: 0 });
    refreshSite(siteId);
    return { ok: true as const };
  });
}

// ---------- languages ----------

export async function addLanguageAction(siteId: string, code: string) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.addLanguage(u.actor, siteId, code);
    refreshSite(siteId);
    return "error" in res ? res : { ok: res.ok, error: res.ok ? undefined : "Someone changed the languages at the same time – please try again." };
  });
}

export async function setLanguageVisibilityAction(siteId: string, code: string, visible: boolean) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.setLanguageVisibility(u.actor, siteId, code, visible);
    refreshSite(siteId);
    return { ok: res.ok };
  });
}

export async function translationPreviewAction(siteId: string, text: string, fileName: string, locale?: string) {
  const u = await requireUser();
  return await guard(async () => await svc.translationImportPlan(u.actor, siteId, text, fileName, locale));
}

export async function applyTranslationAction(siteId: string, text: string, fileName: string, locale: string | undefined, expected: number) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.applyTranslationImport(u.actor, siteId, text, fileName, locale, expected);
    refreshSite(siteId);
    return res;
  });
}

// ---------- settings ----------

export async function updateSettingsAction(siteId: string, input: { name: string; slug: string; notes: string; gaId: string; gtmId: string }) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.updateSiteSettings(u.actor, siteId, input);
    refreshSite(siteId);
    return res;
  });
}

export async function simulateFailureAction(siteId: string, on: boolean) {
  const u = await requireUser();
  return await guard(async () => {
    await svc.setSimulateFailure(u.actor, siteId, on);
    refreshSite(siteId);
    return { ok: true as const };
  });
}

// ---------- bulk ----------

export async function bulkPreviewAction(target: BulkTarget, siteIds: string[], locales: string[], value: string | Record<string, string>) {
  const u = await requireUser();
  return await guard(async () => ({ ok: true as const, plan: await svc.planBulk(u.actor, u.workspaceId, target, siteIds, locales, value) }));
}

export async function bulkApplyAction(input: { target: BulkTarget; siteIds: string[]; locales: string[]; value: string | Record<string, string>; publishNow: boolean; note: string; expected: string[] }) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.applyBulk(u.actor, u.workspaceId, input);
    revalidatePath("/app", "layout");
    return res;
  });
}

// ---------- transfer ----------

export async function exportPackageAction(siteId: string, opts: { includeContact: boolean; includeAnalytics: boolean }) {
  const u = await requireUser();
  return await guard(async () => ({ ok: true as const, ...(await svc.exportPackage(u.actor, siteId, opts)) }));
}

export async function importPackageAction(text: string, target: { clientId?: string; newClientName?: string }) {
  const u = await requireUser();
  return await guard(async () => {
    const res = await svc.importPackage(u.actor, text, { ...target, workspaceId: u.workspaceId });
    revalidatePath("/app", "layout");
    return res;
  });
}

// ---------- public ----------

export async function submitLeadAction(slug: string, input: { name: string; email: string; message: string; locale: string; website: string }) {
  return await svc.submitLead(slug, input);
}

// ---------- team & access ----------

export async function addPersonAction(input: { name: string; email: string; title: string; password: string; isAdmin: boolean }) {
  return await guard(async () => {
    const u = await requireUser();
    const res = await svc.addPerson(u.actor, input);
    revalidatePath("/app/team");
    return res;
  });
}

export async function setClientAccessAction(userId: string, clientId: string, role: "editor" | "publisher" | "none") {
  return await guard(async () => {
    const u = await requireUser();
    const res = await svc.setClientAccess(u.actor, userId, clientId, role === "none" ? null : role);
    revalidatePath("/app/team");
    revalidatePath("/app");
    return res;
  });
}

export async function setAdminAction(userId: string, isAdmin: boolean) {
  return await guard(async () => {
    const u = await requireUser();
    const res = await svc.setAdmin(u.actor, userId, isAdmin);
    revalidatePath("/app/team");
    revalidatePath("/app");
    return res;
  });
}

/** The activity log as a spreadsheet, so it can be kept outside the app or sent to a client. */
export async function exportActivityAction() {
  return await guard(async () => {
    const u = await requireUser();
    return { ok: true as const, csv: await svc.activityCsv(u.actor, u.workspaceId), fileName: `sitedesk-activity-${new Date().toISOString().slice(0, 10)}.csv` };
  });
}
