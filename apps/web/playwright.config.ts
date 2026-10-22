import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL } from "./e2e/accounts";

/**
 * End-to-end tests against the production build with an in-memory MongoDB
 * (see e2e/server.mts). iPhone first: WebKit with an iPhone profile, plus
 * Android Chromium and a desktop browser.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm exec tsx e2e/server.mts",
    url: `${E2E_BASE_URL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
