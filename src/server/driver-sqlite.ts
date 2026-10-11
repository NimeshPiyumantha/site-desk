/**
 * SQLite driver: the default, so the app still runs on one machine with nothing to configure.
 *
 * better-sqlite3 is synchronous, so each method resolves immediately. Transactions nest by
 * counting: SQLite has no nested BEGIN, and the services layer does call one transactional
 * operation from inside another (a bulk publish, for instance).
 */
import Database from "better-sqlite3";
import type { SqlDriver, SqlParams } from "./sql";

const args = (params?: SqlParams): unknown[] => (params === undefined ? [] : Array.isArray(params) ? params : [params]);

export function sqliteDriver(file: string): SqlDriver {
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  let depth = 0;

  return {
    dialect: "sqlite",
    async all<T>(sql: string, params?: SqlParams) {
      return conn.prepare(sql).all(...args(params)) as T[];
    },
    async get<T>(sql: string, params?: SqlParams) {
      return conn.prepare(sql).get(...args(params)) as T | undefined;
    },
    async run(sql: string, params?: SqlParams) {
      conn.prepare(sql).run(...args(params));
    },
    async exec(sql: string) {
      conn.exec(sql);
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      // Not better-sqlite3's own `transaction()` helper: that one refuses to wrap anything async.
      // Nested calls become savepoints, which is what that helper does, so an inner failure still
      // undoes only the inner part – updateSettings calls saveDraft inside its own transaction.
      const nested = depth > 0;
      const name = `sd_sp_${depth}`;
      depth++;
      conn.exec(nested ? `SAVEPOINT ${name}` : "BEGIN");
      try {
        const out = await fn();
        conn.exec(nested ? `RELEASE ${name}` : "COMMIT");
        return out;
      } catch (e) {
        conn.exec(nested ? `ROLLBACK TO ${name}` : "ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
    async close() {
      conn.close();
    },
  };
}
