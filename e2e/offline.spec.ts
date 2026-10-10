import { credentialsFor } from "./accounts";
import { ar, expect, newContext, signIn, test, waitForSynced } from "./fixtures";
import { addStudent, createClass, setPortion, tapScore } from "./helpers";

test("offline: mark a student without a connection, reconnect, and the server has it", async ({
  page,
  browser,
  projectName,
  browserName,
}) => {
  // Playwright can only drive offline + service workers reliably in Chromium.
  // The iPhone (WebKit) offline path is covered by the manual check in the README.
  test.skip(browserName !== "chromium", "offline + service worker needs Chromium in Playwright");
  const account = credentialsFor("offline", projectName);

  await signIn(page, account);
  await createClass(page, "حلقة دون اتصال");
  const classUrl = page.url();
  await addStudent(page, "خالد دون اتصال", "2013");
  await addStudent(page, "زيد دون اتصال", "2014");
  await waitForSynced(page);
  // The app shell is cached after one online visit.
  await page.waitForFunction(async () => (await (await caches.open("pages")).keys()).length >= 6);

  await page.context().setOffline(true);
  await expect(page.getByRole("status").first()).toContainText(ar.sync.offline);

  // خالد recites on the spot and is marked; today's lesson is created offline.
  await page.getByRole("link", { name: /خالد دون اتصال/ }).click();
  await page.waitForURL(/\/student\?id=/);
  const today = page.locator("section[aria-labelledby=today-title]");
  await today.getByRole("button", { name: ar.evaluation.reciteNow }).click();
  await setPortion(page, "الإخلاص", /^112 · الإخلاص/, "1", "4");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await tapScore(today, ar.glossary.memorizationRate, 8);
  await tapScore(today, ar.glossary.behaviorRate, 9);

  // Straight back to the class, as a teacher would: the link waits for the
  // last score to be saved (offline, it's a full page load).
  await page.getByRole("link", { name: ar.nav.back }).click();
  await page.waitForURL(classUrl);

  // زيد is absent, still offline.
  await page.getByRole("link", { name: /زيد دون اتصال/ }).click();
  await page.waitForURL(/\/student\?id=/);
  await today.getByRole("radio", { name: ar.glossary.absent, exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText(ar.sync.offline);

  // Reload while offline: everything is still there (page from the SW cache,
  // data from IndexedDB).
  await page.reload();
  await expect(page.locator("main table tbody tr").first()).toContainText(ar.glossary.absent);

  await page.context().setOffline(false);
  await waitForSynced(page);

  // A fresh device signs in and finds the offline work on the server.
  const otherContext = await newContext(browser);
  const other = await otherContext.newPage();
  await signIn(other, account);
  await other.getByRole("link", { name: /حلقة دون اتصال/ }).click();
  await other.getByRole("link", { name: /خالد دون اتصال/ }).click();
  const table = other.locator("main table");
  await expect(table.locator("tbody tr").first()).toContainText("الإخلاص 1–4");
  await expect(table.locator("tfoot")).toContainText("8.0");
  await expect(table.locator("tfoot")).toContainText("9.0");
  await other.goBack();
  await other.getByRole("link", { name: /زيد دون اتصال/ }).click();
  await expect(other.locator("main table tbody tr").first()).toContainText(ar.glossary.absent);
  await otherContext.close();
});
