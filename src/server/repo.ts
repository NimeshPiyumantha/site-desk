/** Data access: plain functions that read and write rows. No permission checks here (see services.ts). */
import type { SiteContent } from "@/lib/content/types";
import type { DisplayChange } from "@/lib/content/diff";
import type { Actor, Role } from "@/lib/permissions";
import { conn, newId, now } from "./db";

export interface UserRow { id: string; name: string; email: string; title: string; is_admin: number; password_hash: string }
export interface ClientRow { id: string; workspace_id: string; name: string; created_at: string }
export interface SiteRow {
  id: string; client_id: string; name: string; slug: string; created_at: string; created_by: string | null;
  draft_revision: number; live_release_id: string | null;
  review_state: "editing" | "ready"; review_requested_by: string | null; review_requested_at: string | null; review_note: string | null;
  notes: string; simulate_failure: number; copied_from: string | null; checklist: string; show_checklist: number;
}
export interface ReleaseError { step: string; whatHappened: string; whatToDo: string }
export interface ReleaseRow {
  id: string; site_id: string; number: number | null; status: "live" | "previous" | "failed";
  snapshot: string; changes: string; summary: string; note: string; source: string; change_set_id: string | null;
  error: string | null; author_id: string | null; created_at: string;
}
export interface Release extends Omit<ReleaseRow, "snapshot" | "changes" | "error"> {
  content: SiteContent; changeList: DisplayChange[]; errorInfo: ReleaseError | null; authorName: string;
}
export interface BackupRow {
  id: string; site_id: string; label: string; kind: string; draft_snapshot: string; live_snapshot: string | null;
  live_release_number: number | null; created_by: string | null; created_at: string;
}

// ---------- users ----------
export const getUserByEmail = async (email: string) => (await conn()).get<UserRow>("SELECT * FROM users WHERE lower(email) = lower(?)", [email]);
export const getUser = async (id: string) => (await conn()).get<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
export const listUsers = async () => (await conn()).all<UserRow>("SELECT * FROM users ORDER BY is_admin DESC, name");
export const userName = async (id: string | null) => (id ? (await getUser(id))?.name ?? "Unknown person" : "System");

export async function getActor(userId: string): Promise<Actor | null> {
  const u = await getUser(userId);
  if (!u) return null;
  const rows = await (await conn()).all<{ client_id: string; role: Role }>("SELECT client_id, role FROM memberships WHERE user_id = ?", [userId]);
  return { id: u.id, isAdmin: Boolean(u.is_admin), roles: Object.fromEntries(rows.map((r) => [r.client_id, r.role])) };
}

export async function membershipsFor(userId: string) {
  return (await conn()).all<{ role: Role; client: string; client_id: string }>(
    "SELECT m.role, c.name client, c.id client_id FROM memberships m JOIN clients c ON c.id = m.client_id WHERE m.user_id = ? ORDER BY c.name",
    [userId],
  );
}

export async function createUser(input: { name: string; email: string; title: string; passwordHash: string; isAdmin: boolean }): Promise<UserRow> {
  const row: UserRow = { id: newId("usr"), name: input.name, email: input.email, title: input.title, password_hash: input.passwordHash, is_admin: input.isAdmin ? 1 : 0 };
  await (await conn()).run("INSERT INTO users (id, name, email, title, password_hash, is_admin) VALUES (@id, @name, @email, @title, @password_hash, @is_admin)", row as unknown as Record<string, unknown>);
  return row;
}

export const setUserAdmin = async (userId: string, isAdmin: boolean) => (await conn()).run("UPDATE users SET is_admin = ? WHERE id = ?", [isAdmin ? 1 : 0, userId]);

/** Grant or change one person's role on one client. */
export const setMembership = async (userId: string, clientId: string, role: Role) =>
  (await conn()).run("INSERT INTO memberships (user_id, client_id, role) VALUES (?, ?, ?) ON CONFLICT(user_id, client_id) DO UPDATE SET role = excluded.role", [userId, clientId, role]);

export const removeMembership = async (userId: string, clientId: string) => (await conn()).run("DELETE FROM memberships WHERE user_id = ? AND client_id = ?", [userId, clientId]);

export const countAdmins = async () => Number((await (await conn()).get<{ n: number }>("SELECT COUNT(*) n FROM users WHERE is_admin = 1"))?.n ?? 0);

// ---------- workspaces & clients ----------
// Ordered by name rather than SQLite's rowid, which Postgres has no equivalent of.
export const listWorkspaces = async () => (await conn()).all<{ id: string; name: string }>("SELECT * FROM workspaces ORDER BY name");
export const getWorkspace = async (id: string) => (await conn()).get<{ id: string; name: string }>("SELECT * FROM workspaces WHERE id = ?", [id]);
export const listClients = async (workspaceId: string) => (await conn()).all<ClientRow>("SELECT * FROM clients WHERE workspace_id = ? ORDER BY name", [workspaceId]);
export const listAllClients = async () => (await conn()).all<ClientRow>("SELECT * FROM clients ORDER BY name");
export const getClient = async (id: string) => (await conn()).get<ClientRow>("SELECT * FROM clients WHERE id = ?", [id]);

export async function createClient(workspaceId: string, name: string): Promise<ClientRow> {
  const row: ClientRow = { id: newId("cl"), workspace_id: workspaceId, name, created_at: now() };
  await (await conn()).run("INSERT INTO clients (id, workspace_id, name, created_at) VALUES (@id, @workspace_id, @name, @created_at)", row as unknown as Record<string, unknown>);
  return row;
}

// ---------- sites ----------
export const getSite = async (id: string) => (await conn()).get<SiteRow>("SELECT * FROM sites WHERE id = ?", [id]);
export const getSiteBySlug = async (slug: string) => (await conn()).get<SiteRow>("SELECT * FROM sites WHERE slug = ?", [slug]);
export const listSitesForClients = async (clientIds: string[]) =>
  clientIds.length
    ? (await conn()).all<SiteRow>(`SELECT * FROM sites WHERE client_id IN (${clientIds.map(() => "?").join(",")}) ORDER BY name`, clientIds)
    : [];
export const listAllLiveSites = async () => (await conn()).all<SiteRow>("SELECT * FROM sites WHERE live_release_id IS NOT NULL ORDER BY name");

export async function insertSite(row: Partial<SiteRow> & Pick<SiteRow, "id" | "client_id" | "name" | "slug">, content: SiteContent, authorId: string | null, summary: string) {
  const full = { created_at: now(), created_by: authorId, notes: "", copied_from: null, checklist: "[]", show_checklist: 0, ...row };
  const c = await conn();
  await c.run(
    `INSERT INTO sites (id, client_id, name, slug, created_at, created_by, notes, copied_from, checklist, show_checklist, draft_revision)
     VALUES (@id, @client_id, @name, @slug, @created_at, @created_by, @notes, @copied_from, @checklist, @show_checklist, 1)`,
    full as unknown as Record<string, unknown>,
  );
  await c.run("INSERT INTO draft_revisions (site_id, revision, snapshot, author_id, summary, created_at) VALUES (?, 1, ?, ?, ?, ?)", [row.id, JSON.stringify(content), authorId, summary, now()]);
}

export async function updateSite(id: string, fields: Partial<SiteRow>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await (await conn()).run(`UPDATE sites SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`, { ...fields, id } as unknown as Record<string, unknown>);
}

// ---------- drafts ----------
export async function getDraft(siteId: string): Promise<{ revision: number; content: SiteContent }> {
  const site = (await getSite(siteId))!;
  const row = await (await conn()).get<{ snapshot: string }>("SELECT snapshot FROM draft_revisions WHERE site_id = ? AND revision = ?", [siteId, site.draft_revision]);
  return { revision: site.draft_revision, content: JSON.parse(row!.snapshot) };
}

export async function getDraftAt(siteId: string, revision: number): Promise<SiteContent | null> {
  const row = await (await conn()).get<{ snapshot: string }>("SELECT snapshot FROM draft_revisions WHERE site_id = ? AND revision = ?", [siteId, revision]);
  return row ? JSON.parse(row.snapshot) : null;
}

export async function writeDraft(siteId: string, content: SiteContent, authorId: string | null, summary: string): Promise<number> {
  const site = (await getSite(siteId))!;
  const next = site.draft_revision + 1;
  const c = await conn();
  await c.run("INSERT INTO draft_revisions (site_id, revision, snapshot, author_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", [siteId, next, JSON.stringify(content), authorId, summary, now()]);
  await c.run("UPDATE sites SET draft_revision = ? WHERE id = ?", [next, siteId]);
  return next;
}

export async function listDraftRevisions(siteId: string, limit = 30) {
  return (await conn()).all<{ revision: number; author_id: string | null; summary: string; created_at: string }>(
    "SELECT revision, author_id, summary, created_at FROM draft_revisions WHERE site_id = ? ORDER BY revision DESC LIMIT ?",
    [siteId, limit],
  );
}

// ---------- releases ----------
async function hydrate(r: ReleaseRow): Promise<Release> {
  const { snapshot, changes, error, ...rest } = r;
  return { ...rest, content: JSON.parse(snapshot), changeList: JSON.parse(changes), errorInfo: error ? JSON.parse(error) : null, authorName: await userName(r.author_id) };
}
export async function getRelease(id: string): Promise<Release | null> {
  const r = await (await conn()).get<ReleaseRow>("SELECT * FROM releases WHERE id = ?", [id]);
  return r ? hydrate(r) : null;
}
export async function getLiveRelease(site: SiteRow): Promise<Release | null> {
  return site.live_release_id ? getRelease(site.live_release_id) : null;
}
// created_at is strictly increasing (see now()), so it orders these on its own.
export async function listReleases(siteId: string): Promise<Release[]> {
  const rows = await (await conn()).all<ReleaseRow>("SELECT * FROM releases WHERE site_id = ? ORDER BY created_at DESC", [siteId]);
  return Promise.all(rows.map(hydrate));
}
export async function nextReleaseNumber(siteId: string): Promise<number> {
  const r = await (await conn()).get<{ n: number | null }>("SELECT MAX(number) n FROM releases WHERE site_id = ?", [siteId]);
  return Number(r?.n ?? 0) + 1;
}
export async function insertRelease(r: Omit<ReleaseRow, "created_at"> & { created_at?: string }) {
  await (await conn()).run(
    `INSERT INTO releases (id, site_id, number, status, snapshot, changes, summary, note, source, change_set_id, error, author_id, created_at)
     VALUES (@id, @site_id, @number, @status, @snapshot, @changes, @summary, @note, @source, @change_set_id, @error, @author_id, @created_at)`,
    { created_at: now(), ...r } as unknown as Record<string, unknown>,
  );
}
export async function recentFailedReleases(siteIds: string[], limit = 20): Promise<Release[]> {
  if (!siteIds.length) return [];
  const rows = await (await conn()).all<ReleaseRow>(
    `SELECT * FROM releases WHERE status = 'failed' AND site_id IN (${siteIds.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT ?`,
    [...siteIds, limit],
  );
  return Promise.all(rows.map(hydrate));
}
export async function recentReleases(siteIds: string[], limit = 50): Promise<Release[]> {
  if (!siteIds.length) return [];
  const rows = await (await conn()).all<ReleaseRow>(
    `SELECT * FROM releases WHERE site_id IN (${siteIds.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT ?`,
    [...siteIds, limit],
  );
  return Promise.all(rows.map(hydrate));
}

// ---------- backups ----------
export const listBackups = async (siteId: string) => (await conn()).all<BackupRow>("SELECT * FROM backups WHERE site_id = ? ORDER BY created_at DESC", [siteId]);
export const getBackup = async (id: string) => (await conn()).get<BackupRow>("SELECT * FROM backups WHERE id = ?", [id]);
export async function insertBackup(b: Omit<BackupRow, "id" | "created_at">): Promise<string> {
  const id = newId("bk");
  await (await conn()).run(
    `INSERT INTO backups (id, site_id, label, kind, draft_snapshot, live_snapshot, live_release_number, created_by, created_at)
     VALUES (@id, @site_id, @label, @kind, @draft_snapshot, @live_snapshot, @live_release_number, @created_by, @created_at)`,
    { ...b, id, created_at: now() } as unknown as Record<string, unknown>,
  );
  return id;
}

// ---------- change sets ----------
export async function insertChangeSet(title: string, authorId: string, payload: unknown): Promise<string> {
  const id = newId("cs");
  await (await conn()).run("INSERT INTO change_sets (id, title, author_id, created_at, payload) VALUES (?, ?, ?, ?, ?)", [id, title, authorId, now(), JSON.stringify(payload)]);
  return id;
}
export const getChangeSet = async (id: string) =>
  (await conn()).get<{ id: string; title: string; author_id: string; created_at: string; payload: string }>("SELECT * FROM change_sets WHERE id = ?", [id]);

// ---------- leads ----------
export const listLeads = async (siteId: string) =>
  (await conn()).all<{ id: string; name: string; email: string; message: string; locale: string; created_at: string }>("SELECT * FROM leads WHERE site_id = ? ORDER BY created_at DESC", [siteId]);
export async function insertLead(siteId: string, l: { name: string; email: string; message: string; locale: string }) {
  await (await conn()).run("INSERT INTO leads (id, site_id, name, email, message, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [newId("ld"), siteId, l.name, l.email, l.message, l.locale, now()]);
}

// ---------- audit ----------
export interface AuditRow { id: number; at: string; user_id: string | null; client_id: string | null; site_id: string | null; action: string; detail: string }
/** `target` may be a site, or a client on its own (`{ client_id }`) for things that are not about one website. */
export async function audit(userId: string | null, target: { id?: string | null; client_id: string } | null, action: string, detail: string) {
  await (await conn()).run("INSERT INTO audit_log (at, user_id, client_id, site_id, action, detail) VALUES (?, ?, ?, ?, ?, ?)", [now(), userId, target?.client_id ?? null, target?.id ?? null, action, detail]);
}

/**
 * @param includeWorkspaceWide also return entries that belong to no single client
 *        (e.g. adding a person). Only operations admins are shown these.
 */
export async function listAudit(clientIds: string[], siteId?: string, limit = 100, includeWorkspaceWide = false): Promise<AuditRow[]> {
  const c = await conn();
  if (siteId) return c.all<AuditRow>("SELECT * FROM audit_log WHERE site_id = ? ORDER BY id DESC LIMIT ?", [siteId, limit]);
  if (!clientIds.length && !includeWorkspaceWide) return [];
  const byClient = clientIds.length ? `client_id IN (${clientIds.map(() => "?").join(",")})` : "1 = 0";
  const where = includeWorkspaceWide ? `(${byClient} OR client_id IS NULL)` : byClient;
  return c.all<AuditRow>(`SELECT * FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT ?`, [...clientIds, limit]);
}

// ---------- presence ----------
export async function touchPresence(siteId: string, userId: string) {
  await (await conn()).run("INSERT INTO presence (site_id, user_id, last_seen) VALUES (?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET last_seen = excluded.last_seen", [siteId, userId, now()]);
}
export async function activeEditors(siteId: string, exceptUserId: string): Promise<Array<{ user_id: string; name: string; last_seen: string }>> {
  const since = new Date(Date.now() - 60_000).toISOString();
  return (await conn()).all<{ user_id: string; name: string; last_seen: string }>(
    "SELECT p.user_id, u.name, p.last_seen FROM presence p JOIN users u ON u.id = p.user_id WHERE p.site_id = ? AND p.user_id != ? AND p.last_seen > ?",
    [siteId, exceptUserId, since],
  );
}
