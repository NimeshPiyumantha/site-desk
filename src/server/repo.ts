/** Data access: plain functions that read and write rows. No permission checks here (see services.ts). */
import type { SiteContent } from "@/lib/content/types";
import type { DisplayChange } from "@/lib/content/diff";
import type { Actor, Role } from "@/lib/permissions";
import { db, newId, now } from "./db";

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
export const getUserByEmail = (email: string) => db().prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email) as UserRow | undefined;
export const getUser = (id: string) => db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
export const listUsers = () => db().prepare("SELECT * FROM users ORDER BY is_admin DESC, name").all() as UserRow[];
export const userName = (id: string | null) => (id ? getUser(id)?.name ?? "Unknown person" : "System");

export function getActor(userId: string): Actor | null {
  const u = getUser(userId);
  if (!u) return null;
  const rows = db().prepare("SELECT client_id, role FROM memberships WHERE user_id = ?").all(userId) as Array<{ client_id: string; role: Role }>;
  return { id: u.id, isAdmin: Boolean(u.is_admin), roles: Object.fromEntries(rows.map((r) => [r.client_id, r.role])) };
}

export function membershipsFor(userId: string) {
  return db().prepare("SELECT m.role, c.name client, c.id client_id FROM memberships m JOIN clients c ON c.id = m.client_id WHERE m.user_id = ? ORDER BY c.name").all(userId) as Array<{ role: Role; client: string; client_id: string }>;
}

export function createUser(input: { name: string; email: string; title: string; passwordHash: string; isAdmin: boolean }): UserRow {
  const row: UserRow = { id: newId("usr"), name: input.name, email: input.email, title: input.title, password_hash: input.passwordHash, is_admin: input.isAdmin ? 1 : 0 };
  db().prepare("INSERT INTO users (id, name, email, title, password_hash, is_admin) VALUES (@id, @name, @email, @title, @password_hash, @is_admin)").run(row);
  return row;
}

export const setUserAdmin = (userId: string, isAdmin: boolean) => db().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(isAdmin ? 1 : 0, userId);

/** Grant or change one person's role on one client. */
export const setMembership = (userId: string, clientId: string, role: Role) =>
  db().prepare("INSERT INTO memberships (user_id, client_id, role) VALUES (?, ?, ?) ON CONFLICT(user_id, client_id) DO UPDATE SET role = excluded.role").run(userId, clientId, role);

export const removeMembership = (userId: string, clientId: string) => db().prepare("DELETE FROM memberships WHERE user_id = ? AND client_id = ?").run(userId, clientId);

export const countAdmins = () => (db().prepare("SELECT COUNT(*) n FROM users WHERE is_admin = 1").get() as { n: number }).n;

// ---------- workspaces & clients ----------
export const listWorkspaces = () => db().prepare("SELECT * FROM workspaces ORDER BY rowid").all() as Array<{ id: string; name: string }>;
export const getWorkspace = (id: string) => db().prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as { id: string; name: string } | undefined;
export const listClients = (workspaceId: string) => db().prepare("SELECT * FROM clients WHERE workspace_id = ? ORDER BY name").all(workspaceId) as ClientRow[];
export const listAllClients = () => db().prepare("SELECT * FROM clients ORDER BY name").all() as ClientRow[];
export const getClient = (id: string) => db().prepare("SELECT * FROM clients WHERE id = ?").get(id) as ClientRow | undefined;

export function createClient(workspaceId: string, name: string): ClientRow {
  const row: ClientRow = { id: newId("cl"), workspace_id: workspaceId, name, created_at: now() };
  db().prepare("INSERT INTO clients (id, workspace_id, name, created_at) VALUES (@id, @workspace_id, @name, @created_at)").run(row);
  return row;
}

// ---------- sites ----------
export const getSite = (id: string) => db().prepare("SELECT * FROM sites WHERE id = ?").get(id) as SiteRow | undefined;
export const getSiteBySlug = (slug: string) => db().prepare("SELECT * FROM sites WHERE slug = ?").get(slug) as SiteRow | undefined;
export const listSitesForClients = (clientIds: string[]) =>
  clientIds.length ? (db().prepare(`SELECT * FROM sites WHERE client_id IN (${clientIds.map(() => "?").join(",")}) ORDER BY name`).all(...clientIds) as SiteRow[]) : [];
export const listAllLiveSites = () => db().prepare("SELECT * FROM sites WHERE live_release_id IS NOT NULL ORDER BY name").all() as SiteRow[];

export function insertSite(row: Partial<SiteRow> & Pick<SiteRow, "id" | "client_id" | "name" | "slug">, content: SiteContent, authorId: string | null, summary: string) {
  const full = { created_at: now(), created_by: authorId, notes: "", copied_from: null, checklist: "[]", show_checklist: 0, ...row };
  db().prepare(
    `INSERT INTO sites (id, client_id, name, slug, created_at, created_by, notes, copied_from, checklist, show_checklist, draft_revision)
     VALUES (@id, @client_id, @name, @slug, @created_at, @created_by, @notes, @copied_from, @checklist, @show_checklist, 1)`,
  ).run(full);
  db().prepare("INSERT INTO draft_revisions (site_id, revision, snapshot, author_id, summary, created_at) VALUES (?, 1, ?, ?, ?, ?)").run(row.id, JSON.stringify(content), authorId, summary, now());
}

export function updateSite(id: string, fields: Partial<SiteRow>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db().prepare(`UPDATE sites SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...fields, id });
}

// ---------- drafts ----------
export function getDraft(siteId: string): { revision: number; content: SiteContent } {
  const site = getSite(siteId)!;
  const row = db().prepare("SELECT snapshot FROM draft_revisions WHERE site_id = ? AND revision = ?").get(siteId, site.draft_revision) as { snapshot: string };
  return { revision: site.draft_revision, content: JSON.parse(row.snapshot) };
}

export function getDraftAt(siteId: string, revision: number): SiteContent | null {
  const row = db().prepare("SELECT snapshot FROM draft_revisions WHERE site_id = ? AND revision = ?").get(siteId, revision) as { snapshot: string } | undefined;
  return row ? JSON.parse(row.snapshot) : null;
}

export function writeDraft(siteId: string, content: SiteContent, authorId: string | null, summary: string): number {
  const site = getSite(siteId)!;
  const next = site.draft_revision + 1;
  db().prepare("INSERT INTO draft_revisions (site_id, revision, snapshot, author_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(siteId, next, JSON.stringify(content), authorId, summary, now());
  db().prepare("UPDATE sites SET draft_revision = ? WHERE id = ?").run(next, siteId);
  return next;
}

export function listDraftRevisions(siteId: string, limit = 30) {
  return db().prepare("SELECT revision, author_id, summary, created_at FROM draft_revisions WHERE site_id = ? ORDER BY revision DESC LIMIT ?").all(siteId, limit) as Array<{ revision: number; author_id: string | null; summary: string; created_at: string }>;
}

// ---------- releases ----------
function hydrate(r: ReleaseRow): Release {
  const { snapshot, changes, error, ...rest } = r;
  return { ...rest, content: JSON.parse(snapshot), changeList: JSON.parse(changes), errorInfo: error ? JSON.parse(error) : null, authorName: userName(r.author_id) };
}
export function getRelease(id: string): Release | null {
  const r = db().prepare("SELECT * FROM releases WHERE id = ?").get(id) as ReleaseRow | undefined;
  return r ? hydrate(r) : null;
}
export function getLiveRelease(site: SiteRow): Release | null {
  return site.live_release_id ? getRelease(site.live_release_id) : null;
}
export function listReleases(siteId: string): Release[] {
  return (db().prepare("SELECT * FROM releases WHERE site_id = ? ORDER BY created_at DESC, rowid DESC").all(siteId) as ReleaseRow[]).map(hydrate);
}
export function nextReleaseNumber(siteId: string): number {
  const r = db().prepare("SELECT MAX(number) n FROM releases WHERE site_id = ?").get(siteId) as { n: number | null };
  return (r.n ?? 0) + 1;
}
export function insertRelease(r: Omit<ReleaseRow, "created_at"> & { created_at?: string }) {
  db().prepare(
    `INSERT INTO releases (id, site_id, number, status, snapshot, changes, summary, note, source, change_set_id, error, author_id, created_at)
     VALUES (@id, @site_id, @number, @status, @snapshot, @changes, @summary, @note, @source, @change_set_id, @error, @author_id, @created_at)`,
  ).run({ created_at: now(), ...r });
}
export function recentFailedReleases(siteIds: string[], limit = 20): Release[] {
  if (!siteIds.length) return [];
  return (db().prepare(`SELECT * FROM releases WHERE status = 'failed' AND site_id IN (${siteIds.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT ?`).all(...siteIds, limit) as ReleaseRow[]).map(hydrate);
}
export function recentReleases(siteIds: string[], limit = 50): Release[] {
  if (!siteIds.length) return [];
  return (db().prepare(`SELECT * FROM releases WHERE site_id IN (${siteIds.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT ?`).all(...siteIds, limit) as ReleaseRow[]).map(hydrate);
}

// ---------- backups ----------
export const listBackups = (siteId: string) => db().prepare("SELECT * FROM backups WHERE site_id = ? ORDER BY created_at DESC, rowid DESC").all(siteId) as BackupRow[];
export const getBackup = (id: string) => db().prepare("SELECT * FROM backups WHERE id = ?").get(id) as BackupRow | undefined;
export function insertBackup(b: Omit<BackupRow, "id" | "created_at">): string {
  const id = newId("bk");
  db().prepare(
    `INSERT INTO backups (id, site_id, label, kind, draft_snapshot, live_snapshot, live_release_number, created_by, created_at)
     VALUES (@id, @site_id, @label, @kind, @draft_snapshot, @live_snapshot, @live_release_number, @created_by, @created_at)`,
  ).run({ ...b, id, created_at: now() });
  return id;
}

// ---------- change sets ----------
export function insertChangeSet(title: string, authorId: string, payload: unknown): string {
  const id = newId("cs");
  db().prepare("INSERT INTO change_sets (id, title, author_id, created_at, payload) VALUES (?, ?, ?, ?, ?)").run(id, title, authorId, now(), JSON.stringify(payload));
  return id;
}
export const getChangeSet = (id: string) => db().prepare("SELECT * FROM change_sets WHERE id = ?").get(id) as { id: string; title: string; author_id: string; created_at: string; payload: string } | undefined;

// ---------- leads ----------
export const listLeads = (siteId: string) => db().prepare("SELECT * FROM leads WHERE site_id = ? ORDER BY created_at DESC").all(siteId) as Array<{ id: string; name: string; email: string; message: string; locale: string; created_at: string }>;
export function insertLead(siteId: string, l: { name: string; email: string; message: string; locale: string }) {
  db().prepare("INSERT INTO leads (id, site_id, name, email, message, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(newId("ld"), siteId, l.name, l.email, l.message, l.locale, now());
}

// ---------- audit ----------
export interface AuditRow { id: number; at: string; user_id: string | null; client_id: string | null; site_id: string | null; action: string; detail: string }
/** `target` may be a site, or a client on its own (`{ client_id }`) for things that are not about one website. */
export function audit(userId: string | null, target: { id?: string | null; client_id: string } | null, action: string, detail: string) {
  db().prepare("INSERT INTO audit_log (at, user_id, client_id, site_id, action, detail) VALUES (?, ?, ?, ?, ?, ?)").run(now(), userId, target?.client_id ?? null, target?.id ?? null, action, detail);
}

/**
 * @param includeWorkspaceWide also return entries that belong to no single client
 *        (e.g. adding a person). Only operations admins are shown these.
 */
export function listAudit(clientIds: string[], siteId?: string, limit = 100, includeWorkspaceWide = false) {
  if (siteId) return db().prepare("SELECT * FROM audit_log WHERE site_id = ? ORDER BY id DESC LIMIT ?").all(siteId, limit) as AuditRow[];
  if (!clientIds.length && !includeWorkspaceWide) return [];
  const byClient = clientIds.length ? `client_id IN (${clientIds.map(() => "?").join(",")})` : "0";
  const where = includeWorkspaceWide ? `(${byClient} OR client_id IS NULL)` : byClient;
  return db().prepare(`SELECT * FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT ?`).all(...clientIds, limit) as AuditRow[];
}

// ---------- presence ----------
export function touchPresence(siteId: string, userId: string) {
  db().prepare("INSERT INTO presence (site_id, user_id, last_seen) VALUES (?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET last_seen = excluded.last_seen").run(siteId, userId, now());
}
export function activeEditors(siteId: string, exceptUserId: string): Array<{ user_id: string; name: string; last_seen: string }> {
  const since = new Date(Date.now() - 60_000).toISOString();
  return db().prepare("SELECT p.user_id, u.name, p.last_seen FROM presence p JOIN users u ON u.id = p.user_id WHERE p.site_id = ? AND p.user_id != ? AND p.last_seen > ?").all(siteId, exceptUserId, since) as Array<{ user_id: string; name: string; last_seen: string }>;
}
