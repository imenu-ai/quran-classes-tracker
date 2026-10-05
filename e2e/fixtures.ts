import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import { E2E_BASE_URL, E2E_PASSWORD } from "./accounts";

export { ar, en, expect };

let ipCounter = 0;

/**
 * A unique client IP per context: the app trusts a single-value
 * x-forwarded-for, so each test gets its own sign-in rate-limit bucket.
 */
export function uniqueIp(): string {
  ipCounter += 1;
  return `198.51.${100 + Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

export async function newContext(
  browser: import("@playwright/test").Browser,
  options: Parameters<import("@playwright/test").Browser["newContext"]>[0] = {},
): Promise<BrowserContext> {
  return browser.newContext({
    ...options,
    extraHTTPHeaders: { ...options.extraHTTPHeaders, "x-forwarded-for": uniqueIp() },
  });
}

export async function signIn(page: Page, username: string) {
  await page.goto(`${E2E_BASE_URL}/login`);
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${E2E_BASE_URL}/`);
}

/** Waits until the sync indicator reads "connected" (everything pushed). */
export async function waitForSynced(page: Page, messages: typeof ar = ar) {
  await expect(page.getByRole("status").first()).toHaveText(messages.sync.connected, {
    timeout: 30_000,
  });
}

export const test = base.extend<{ projectName: string }>({
  projectName: async ({}, use, testInfo) => {
    await use(testInfo.project.name);
  },
  context: async ({ browser, contextOptions }, use) => {
    const context = await newContext(browser, contextOptions);
    await use(context);
    await context.close();
  },
});
