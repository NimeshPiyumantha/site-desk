import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run the real app against a separate, freshly seeded database.
 *
 *   npm run test:e2e        SQLite in data/e2e (the default; needs nothing)
 *   npm run test:e2e:pg     a Postgres database named by E2E_DATABASE_URL
 *
 * Either way the database is emptied first, because the suite rewrites the demo data. The Postgres
 * variable is deliberately NOT `DATABASE_URL`: the tests must never point themselves at the
 * database in .env just because it happens to be there.
 */
const e2ePostgres = process.env.E2E_DATABASE_URL?.trim() ?? "";

export default defineConfig({
  testDir: "tests/e2e",
  // A hosted database is a network round trip per query, and operations such as a bulk publish
  // make dozens in sequence: against Supabase in another region the suite runs about twenty times
  // slower than against the local file it was written for. The work still completes; only these
  // waits were too short for it.
  timeout: e2ePostgres ? 420_000 : 120_000,
  expect: { timeout: e2ePostgres ? 90_000 : 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    screenshot: "only-on-failure",
  },
  webServer: {
    // The reset runs as part of starting the server, so it cannot race the first request.
    command: "npx tsx scripts/e2e-reset.mts && npx next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      SITEDESK_DATA_DIR: "data/e2e",
      // Empty unless E2E_DATABASE_URL was set, so a DATABASE_URL in .env is never picked up here.
      DATABASE_URL: e2ePostgres,
      E2E_DATABASE_URL: e2ePostgres,
    },
  },
});
