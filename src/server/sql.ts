/**
 * The small database interface the rest of the server talks to.
 *
 * Queries are written once, in SQLite's style: `?` for positional parameters and `@name` for named
 * ones. A Postgres driver rewrites them to `$1 … $n`, so no query is written twice. Everything is
 * async because a hosted database is over the network; the SQLite driver simply resolves at once.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type SqlParams = unknown[] | Record<string, unknown>;

export interface SqlConnection {
  all<T>(sql: string, params?: SqlParams): Promise<T[]>;
  get<T>(sql: string, params?: SqlParams): Promise<T | undefined>;
  run(sql: string, params?: SqlParams): Promise<void>;
  /** Several statements in one go, for the schema. */
  exec(sql: string): Promise<void>;
}

export interface SqlDriver extends SqlConnection {
  dialect: "sqlite" | "postgres";
  /** Runs `fn` in a transaction; everything inside it sees the same connection. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * The connection the current transaction is using, if any. Queries inside a transaction have to go
 * to the connection holding it – with a pool, any other connection cannot see its uncommitted rows
 * and would deadlock against its locks.
 */
export const txStore = new AsyncLocalStorage<SqlConnection>();

/** Turns `?` and `@name` into `$1 … $n` and lines the values up in the same order. */
export function toPositional(sql: string, params?: SqlParams): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  if (Array.isArray(params) || params === undefined) {
    const list = params ?? [];
    let i = 0;
    const text = sql.replace(/\?/g, () => {
      values.push(list[i++]);
      return `$${values.length}`;
    });
    return { text, values };
  }
  const seen = new Map<string, number>();
  const text = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
    const already = seen.get(name);
    if (already) return `$${already}`;
    values.push(params[name]);
    seen.set(name, values.length);
    return `$${values.length}`;
  });
  return { text, values };
}
