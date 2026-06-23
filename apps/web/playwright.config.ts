import { defineConfig, devices } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001";
const WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:5173";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://pricepilot:pricepilot@localhost:5432/pricepilot?schema=public";

/**
 * End-to-end smoke test config. Playwright boots the API + web dev servers
 * (reusing already-running ones locally) and runs the browser flow. Kept out of
 * the unit suites — run with `pnpm --filter @sail/web e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI also emit the HTML report so the workflow can upload it on failure.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @sail/api dev",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // production: default pino logger (avoids the dev pino-pretty transport).
        NODE_ENV: "production",
        DATABASE_URL,
        JWT_SECRET: "e2e-secret",
        RESPECT_ROBOTS: "false",
        CORS_ORIGIN: WEB_URL,
      },
    },
    {
      command: "pnpm --filter @sail/web dev",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
