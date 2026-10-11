/**
 * Empties whichever database the end-to-end run is about to use, so the suite starts from the
 * demo data it expects. The app recreates the schema and seeds it on the first request.
 *
 * Without E2E_DATABASE_URL this only deletes the local SQLite directory. With it, the tables are
 * dropped from that Postgres database – which is why the variable is separate from DATABASE_URL:
 * pointing the tests at a database has to be a deliberate act, not a side effect of having a .env.
 */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SITEDESK_DATA_DIR ?? "data/e2e";
const DB_SOURCE = path.join("src", "server", "db.ts");

/**
 * Taken from the schema in db.ts, read as text rather than imported: this script only needs the
 * table names, and importing the module would pull in the native SQLite binding to get them.
 * Reading the one source of truth means a table added later is dropped without editing this file.
 */
function appTables(): string[] {
  const source = fs.readFileSync(DB_SOURCE, "utf8");
  const names = [...source.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  if (!names.length) throw new Error(`No CREATE TABLE statements found in ${DB_SOURCE}`);
  return names;
}

const url = process.env.E2E_DATABASE_URL?.trim();

if (!url) {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`[e2e] SQLite: removed ${DATA_DIR}`);
} else {
  const host = (() => { try { return new URL(url).host; } catch { return "unparseable"; } })();
  const tables = appTables();
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20_000 });
  await client.connect();
  await client.query(`DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE`);
  await client.end();
  console.log(`[e2e] Postgres at ${host}: dropped ${tables.length} tables (${tables.join(", ")})`);
  // Pictures live in the database now, but an earlier local run may have left files behind.
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
