import { accountFor } from "./accounts";
import { ar, expect, newContext, signIn, test, waitForSynced } from "./fixtures";
import { addStudent, createClass, setPortion, tapScore } from "./helpers";

test("offline lesson: work offline, reconnect, and the server has everything", async ({
  page,
  browser,
  projectName,
  browserName,
}) => {
  // Playwright can only drive offline + service workers reliably in Chromium.
  // The iPhone (WebKit) offline path is covered by the manual check in the README.
  test.skip(browserName !== "chromium", "offline + service worker needs Chromium in Playwright");
  const username = accountFor("offline", projectName);

  await signIn(page, username);
  await createClass(page, "حلقة دون اتصال");
  await addStudent(page, "خالد دون اتصال", "2013");
  await waitForSynced(page);
  // The app shell is cached after one online visit.
  await page.waitForFunction(async () => (await (await caches.open("pages")).keys()).length >= 6);

  await page.context().setOffline(true);
  await expect(page.getByRole("status").first()).toContainText(ar.sync.offline);

  await page.getByRole("button", { name: ar.glossary.newLesson }).click();
  await page.waitForURL(/\/lesson\?id=/);
  await page.getByRole("button", { name: ar.attendance.markAllPresent }).click();
  await page.getByRole("tab", { name: ar.lessons.stepEvaluate }).click();
  const card = page.locator("main article").filter({ hasText: "خالد دون اتصال" });
  await card.getByRole("button", { name: ar.evaluation.reciteNow }).click();
  await setPortion(page, "الإخلاص", /^112 · الإخلاص/, "1", "4");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await tapScore(card, ar.glossary.memorizationRate, 8);
  await tapScore(card, ar.glossary.behaviorRate, 9);
  await expect(page.getByRole("status").first()).toContainText(ar.sync.offline);

  // Reload while offline: the lesson is still there (page from the SW cache,
  // data from IndexedDB).
  await page.reload();
  await page.getByRole("tab", { name: ar.lessons.stepEvaluate }).click();
  await expect(page.locator("main article").filter({ hasText: "الإخلاص 1–4" })).toBeVisible();

  await page.context().setOffline(false);
  await waitForSynced(page);

  // A fresh device signs in and finds the offline work on the server.
  const otherContext = await newContext(browser);
  const other = await otherContext.newPage();
  await signIn(other, username);
  await other.getByRole("link", { name: /حلقة دون اتصال/ }).click();
  await other.getByRole("link", { name: /خالد دون اتصال/ }).click();
  const month = other
    .getByRole("group", { name: ar.profile.selectMonth })
    .getByRole("button")
    .first();
  await expect(month).toContainText("8.0");
  await expect(month).toContainText("9.0");
  await expect(other.getByRole("button", { name: /الإخلاص 1–4/ })).toBeVisible();
  await otherContext.close();
});
