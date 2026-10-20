import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
const channel =
  process.env["PLAYWRIGHT_CHANNEL"] ||
  (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "chrome"
    : undefined);
process.env["E2E_PASSWORD"] ||= randomBytes(24).toString("hex");
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  globalTimeout: 180000,
  use: {
    baseURL: "http://localhost:4310",
    channel,
    trace: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        defaultBrowserType: "chromium",
        channel,
      },
    },
  ],
  webServer: {
    command: "node e2e/server.mjs",
    url: "http://localhost:4310/health",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    env: { E2E_PASSWORD: process.env["E2E_PASSWORD"]! },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
