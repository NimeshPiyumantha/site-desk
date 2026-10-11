/**
 * Postgres driver, used when DATABASE_URL is set – a Supabase project, for instance.
 *
 * Queries are written in SQLite's style everywhere else in the server, so each one is rewritten to
 * `$1 … $n` here. A transaction takes a connection out of the pool and pins it for the duration,
 * because another connection cannot see its uncommitted rows.
 */
import { Pool, types, type PoolClient } from "pg";
import { toPositional, txStore, type SqlConnection, type SqlDriver, type SqlParams } from "./sql";

/**
 * Postgres hands back 64-bit integers as strings, so `SELECT COUNT(*) n` would arrive as "0" –
 * truthy, and never equal to 0. The app treats these as numbers, so parse them as numbers.
 */
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)));

export function postgresDriver(connectionString: string): SqlDriver {
  const pool = new Pool({
    connectionString,
    // Supabase requires TLS, and the pooler presents a certificate for its own host name.
    ssl: { rejectUnauthorized: false },
    // A serverless instance should hold very few: the pooler is what does the real pooling.
    max: Number(process.env.DATABASE_POOL_MAX ?? 4),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });

  const query = async (client: Pick<PoolClient, "query"> | Pool, sql: string, params?: SqlParams) => {
    const { text, values } = toPositional(sql, params);
    const res = await client.query(text, values);
    return res.rows as Record<string, unknown>[];
  };

  const on = (client?: PoolClient): SqlConnection => ({
    async all<T>(sql: string, params?: SqlParams) {
      return (await query(client ?? pool, sql, params)) as T[];
    },
    async get<T>(sql: string, params?: SqlParams) {
      return (await query(client ?? pool, sql, params))[0] as T | undefined;
    },
    async run(sql: string, params?: SqlParams) {
      await query(client ?? pool, sql, params);
    },
    async exec(sql: string) {
      // Several statements in one string: no parameters, so it goes straight through.
      await (client ?? pool).query(sql);
    },
  });

  let depth = 0;
  const base = on();

  return {
    dialect: "postgres",
    all: base.all,
    get: base.get,
    run: base.run,
    exec: base.exec,
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      const existing = txStore.getStore();
      if (existing) {
        // Already inside one: a savepoint, so an inner failure undoes only the inner part.
        const name = `sd_sp_${depth++}`;
        await existing.run(`SAVEPOINT ${name}`);
        try {
          const out = await fn();
          await existing.run(`RELEASE SAVEPOINT ${name}`);
          return out;
        } catch (e) {
          await existing.run(`ROLLBACK TO SAVEPOINT ${name}`);
          throw e;
        } finally {
          depth--;
        }
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await txStore.run(on(client), fn);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The connection is already unusable; releasing it below is all that is left to do.
        }
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
