/**
 * Runs the end-to-end suite against Postgres.
 *
 * E2E_DATABASE_URL has to be set explicitly and is never taken from DATABASE_URL in .env: the
 * suite DROPS every table before it starts, so which database it points at must be a decision,
 * not an accident. Give it a throwaway or development database.
 */
import { spawn } from "node:child_process";

const url = process.env.E2E_DATABASE_URL?.trim();

if (!url) {
  console.error(`
E2E_DATABASE_URL is not set.

This run DROPS every table in the database it is given, then lets the app recreate and seed it.
Point it at a throwaway or development database – never one with anything you want to keep.

  bash/zsh    E2E_DATABASE_URL='postgresql://…' npm run test:e2e:pg
  PowerShell  $env:E2E_DATABASE_URL='postgresql://…'; npm run test:e2e:pg

For the default SQLite run, which needs nothing, use: npm run test:e2e
`.trim());
  process.exit(1);
}

let host = "unparseable";
try { host = new URL(url).host; } catch {}
console.log(`[e2e] Postgres mode: every table in ${host} will be dropped and reseeded.\n`);

const child = spawn("npx", ["playwright", "test"], { stdio: "inherit", shell: true, env: process.env });
child.on("close", (code) => process.exit(code ?? 1));
