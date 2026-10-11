import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedDemo } from "./seed";

/**
 * SQLite database (a single file in ./data). The schema is created – and the demo data seeded –
 * automatically the first time the app starts, so reviewers do not need any setup step.
 *
 * On a serverless host (Vercel) the project directory is read-only, so the database lives in /tmp
 * instead. That disk is per-instance and temporary: demo data is re-seeded on a cold start and
 * changes do not outlive the instance. Running locally – or pointing SITEDESK_DATA_DIR at a real
 * volume – keeps everything.
 */
const DEFAULT_DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "sitedesk")
  : path.join(process.cwd(), "data");

export const DATA_DIR = process.env.SITEDESK_DATA_DIR ?? DEFAULT_DATA_DIR;
export const DB_FILE = path.join(DATA_DIR, "sitedesk.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL REFERENCES clients(id),
  role TEXT NOT NULL CHECK (role IN ('editor','publisher')), PRIMARY KEY (user_id, client_id)
);
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, created_by TEXT,
  draft_revision INTEGER NOT NULL DEFAULT 1,
  live_release_id TEXT,
  review_state TEXT NOT NULL DEFAULT 'editing' CHECK (review_state IN ('editing','ready')),
  review_requested_by TEXT, review_requested_at TEXT, review_note TEXT,
  notes TEXT NOT NULL DEFAULT '',
  simulate_failure INTEGER NOT NULL DEFAULT 0,
  copied_from TEXT, checklist TEXT NOT NULL DEFAULT '[]', show_checklist INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS draft_revisions (
  site_id TEXT NOT NULL REFERENCES sites(id), revision INTEGER NOT NULL, snapshot TEXT NOT NULL,
  author_id TEXT, summary TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (site_id, revision)
);
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), number INTEGER, -- NULL for failed launches
  status TEXT NOT NULL CHECK (status IN ('live','previous','failed')),
  snapshot TEXT NOT NULL, changes TEXT NOT NULL, summary TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL, change_set_id TEXT, error TEXT, author_id TEXT, created_at TEXT NOT NULL,
  UNIQUE (site_id, number)
);
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), label TEXT NOT NULL, kind TEXT NOT NULL,
  draft_snapshot TEXT NOT NULL, live_snapshot TEXT, live_release_number INTEGER,
  created_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS change_sets (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, author_id TEXT, created_at TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), name TEXT NOT NULL, email TEXT NOT NULL,
  message TEXT NOT NULL, locale TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT, client_id TEXT, site_id TEXT,
  action TEXT NOT NULL, detail TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS presence (
  site_id TEXT NOT NULL, user_id TEXT NOT NULL, last_seen TEXT NOT NULL, PRIMARY KEY (site_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_releases_site ON releases(site_id, number);
CREATE INDEX IF NOT EXISTS idx_audit_site ON audit_log(site_id, at);
`;

// One connection per process. Stored on globalThis because Next.js can load this module more than
// once (page rendering and server actions are bundled separately); two connections would not
// always see each other's newest writes.
const g = globalThis as unknown as { __sitedeskDb?: Database.Database | null };

export function db(): Database.Database {
  if (g.__sitedeskDb) return g.__sitedeskDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const fresh = !fs.existsSync(DB_FILE);
  const conn = new Database(DB_FILE);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  conn.exec(SCHEMA);
  g.__sitedeskDb = conn;
  if (fresh || (conn.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n === 0) {
    seedDemo(conn);
  }
  return conn;
}

export function closeDb() {
  g.__sitedeskDb?.close();
  g.__sitedeskDb = null;
}

export function now(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
