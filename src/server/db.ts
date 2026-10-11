import fs from "node:fs";
import path from "node:path";
import { sqliteDriver } from "./driver-sqlite";
import { seedDemo } from "./seed";
import { txStore, type SqlConnection, type SqlDriver } from "./sql";

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

/** The one construct above that is not already valid in both dialects. */
function schemaFor(dialect: "sqlite" | "postgres"): string {
  return dialect === "postgres"
    ? SCHEMA.replace("id INTEGER PRIMARY KEY AUTOINCREMENT", "id BIGSERIAL PRIMARY KEY")
    : SCHEMA;
}

/**
 * One driver per process, kept on globalThis because Next.js can load this module more than once
 * (page rendering and server actions are bundled separately) and two connections would not always
 * see each other's newest writes. The promise is stored, not the driver, so concurrent callers
 * during start-up wait for one set-up rather than racing to seed twice.
 */
const g = globalThis as unknown as { __sitedeskDriver?: Promise<SqlDriver> | null };

/** Any constant will do; it only has to be the same in every copy of the app. */
const SET_UP_LOCK = 7274110001;

async function setUp(): Promise<SqlDriver> {
  const url = process.env.DATABASE_URL?.trim();
  const driver = url ? (await import("./driver-postgres")).postgresDriver(url) : sqliteDriver(prepareLocalDir());
  try {
    if (driver.dialect === "postgres") await initShared(driver);
    else await initLocal(driver);
    return driver;
  } catch (e) {
    // Leave nothing half-open behind; db() will let the next request try again.
    await driver.close().catch(() => {});
    throw e;
  }
}

/**
 * Creating the schema and seeding, where several copies of the app may start at once against the
 * same database. Both have to happen under a lock: concurrent `CREATE TABLE IF NOT EXISTS` can
 * still collide in the catalogue, and two seeders would each insert the demo rows. Whoever gets
 * the lock does the work; the others wait and then find it already done.
 */
async function initShared(driver: SqlDriver) {
  await driver.transaction(async () => {
    const c = txStore.getStore() ?? driver;
    await c.run(`SELECT pg_advisory_xact_lock(${SET_UP_LOCK})`);
    await c.exec(schemaFor("postgres"));
    if (await isEmpty(c)) await seedDemo(driver);
  });
}

/** One file, one process: the transaction inside seedDemo is enough. */
async function initLocal(driver: SqlDriver) {
  await driver.exec(schemaFor(driver.dialect));
  if (await isEmpty(driver)) await seedDemo(driver);
}

async function isEmpty(c: SqlConnection): Promise<boolean> {
  const count = await c.get<{ n: number }>("SELECT COUNT(*) n FROM users");
  return Number(count?.n ?? 0) === 0;
}

/** The SQLite file and the uploads directory both live in the data directory. */
function prepareLocalDir(): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return DB_FILE;
}

export function db(): Promise<SqlDriver> {
  // On failure the stored promise is cleared, so the next request starts over. Keeping a rejected
  // promise would leave this copy of the app answering every later request with the same error.
  g.__sitedeskDriver ??= setUp().catch((e) => {
    g.__sitedeskDriver = null;
    throw e;
  });
  return g.__sitedeskDriver;
}

/**
 * The connection a query should use: the one holding the current transaction if there is one,
 * otherwise the driver itself.
 */
export async function conn(): Promise<SqlConnection> {
  return txStore.getStore() ?? (await db());
}

/** Runs `fn` inside a transaction. Nested calls join the outer one as a savepoint. */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  return (await db()).transaction(fn);
}

export async function closeDb() {
  const existing = g.__sitedeskDriver;
  g.__sitedeskDriver = null;
  if (existing) await (await existing).close();
}

/**
 * Strictly increasing, so `created_at` orders rows reliably even when several are written in the
 * same millisecond. Release and backup history used to lean on SQLite's rowid for that, which
 * Postgres has no equivalent of.
 */
let lastNow = 0;
export function now(): string {
  const t = Math.max(Date.now(), lastNow + 1);
  lastNow = t;
  return new Date(t).toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
