import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run the real app against a separate, freshly seeded database (data/e2e).
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    screenshot: "only-on-failure",
  },
  webServer: {
    // Wipe the e2e database first; the app seeds fresh demo data on start.
    command: "node -e \"require('fs').rmSync('data/e2e',{recursive:true,force:true})\" && npx next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { SITEDESK_DATA_DIR: "data/e2e" },
  },
});
