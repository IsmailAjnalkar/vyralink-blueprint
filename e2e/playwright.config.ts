// End-to-end tests through the real web UI against a fresh database (vyralink_e2e).
// Needs the local Postgres running (npm run db:start) and a web build (npm run build -w @vyralink/web).
// Locally the system Edge is used (PW_CHANNEL=msedge, the default on Windows); CI installs Playwright's Chromium.
import { defineConfig } from "@playwright/test";

export const API = "http://127.0.0.1:4120";
export const WEB = "http://localhost:3120";
export const DB = "postgres://postgres:postgres@127.0.0.1:5441/vyralink_e2e";
export const ADMIN = { email: "admin@e2e.local", password: "E2E-Admin-Password-1" };

const channel = process.env.PW_CHANNEL ?? (process.platform === "win32" && !process.env.CI ? "msedge" : undefined);

export default defineConfig({
  testDir: ".",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: WEB, channel, trace: "retain-on-failure" },
  webServer: [
    {
      command: "node e2e/reset-db.mjs && node apps/api/src/migrate.js && node apps/api/src/server.js",
      cwd: "..",
      url: `${API}/v1/health`,
      reuseExistingServer: false,
      env: { DATABASE_URL: DB, PORT: "4120", TRUST_PROXY_HOPS: "1", RATE_LIMIT_SCALE: "50", ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, DEV_MAIL_DIR: "e2e/.mail", STORAGE_DIR: "e2e/.storage" },
    },
    {
      command: "npx next start -p 3120",
      cwd: "../apps/web",
      url: WEB,
      reuseExistingServer: false,
      env: { API_URL: API },
    },
  ],
});
