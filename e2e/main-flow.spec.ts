import { credentialsFor } from "./accounts";
import { ar, expect, signIn, test, waitForSynced } from "./fixtures";
import { addStudent, createClass, setPortion, tapScore } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Two days with one class: day one, a student recites on the spot, gets
 * marks and homework for the next day; another is absent. Day two, the
 * homework is due: postponed, undone, then marked. The month table shows it all.
 */
test("class → students → student page: mark, next-day homework, absence, postpone", async ({
  page,
  projectName,
}, testInfo) => {
  // A controllable clock, to move to the next day later.
  await page.clock.install({ time: new Date() });
  await signIn(page, credentialsFor("main", projectName));

  // First use: empty state invites creating a class.
  await expect(page.getByText(ar.classes.emptyTitle)).toBeVisible();
  await createClass(page, "حلقة الاختبار");
  const classUrl = page.url();
  await addStudent(page, "أحمد التجريبي", "2014");
  await addStudent(page, "سالم التجريبي", "2015");
  // The class page is just its students.
  await expect(page.getByRole("button", { name: ar.glossary.newLesson })).toHaveCount(0);

  // Day one, أحمد: nothing pending, so he recites on the spot.
  await page.getByRole("link", { name: /أحمد التجريبي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  const today = page.locator("section[aria-labelledby=today-title]");
  await today.getByRole("button", { name: ar.evaluation.reciteNow }).click();
  await setPortion(page, "الفلق", /^113 · الفلق/, "1", "5");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await expect(today.getByText("الفلق 1–5")).toBeVisible();

  // How quickly a score tap shows as selected, measured in the page so
  // Playwright's own click overhead isn't counted (production build).
  const memorization = today
    .getByRole("group", { name: ar.glossary.memorizationRate })
    .getByRole("button", { name: "9", exact: true });
  const tapMs = await memorization.evaluate(async (button: HTMLElement) => {
    const started = performance.now();
    button.click();
    while (button.getAttribute("aria-pressed") !== "true") {
      await new Promise(requestAnimationFrame);
    }
    return Math.round(performance.now() - started);
  });
  testInfo.annotations.push({ type: "score-tap-ms", description: String(tapMs) });
  await tapScore(today, ar.glossary.behaviorRate, 10);

  // Homework for the next day: suggested after الفلق, clamped to An-Nas.
  await today.getByRole("button", { name: ar.today.addNext }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: ar.glossary.surah }),
  ).toContainText("114 · الناس");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await expect(today.getByText("الناس 1–5")).toBeVisible();

  // The month table: today's row and the averages.
  const table = page.locator("main table");
  await expect(table.locator("tbody tr").first()).toContainText("الفلق 1–5");
  await expect(table.locator("tbody tr").first()).toContainText("9");
  await expect(table.locator("tfoot")).toContainText("9.0");
  await expect(table.locator("tfoot")).toContainText("10.0");

  // سالم is absent today.
  await page.goto(classUrl);
  await page.getByRole("link", { name: /سالم التجريبي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  await today.getByRole("radio", { name: ar.glossary.absent, exact: true }).click();
  await expect(today.getByText(ar.today.absentNote)).toBeVisible();
  await expect(table.locator("tbody tr").first()).toContainText(ar.glossary.absent);
  await waitForSynced(page);

  // Day two, أحمد: yesterday's homework is due. Postpone, undo, then mark it.
  await page.clock.setSystemTime(Date.now() + DAY_MS);
  await page.goto(classUrl);
  await page.getByRole("link", { name: /أحمد التجريبي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  const due = today.locator("li").filter({ hasText: "الناس 1–5" });
  await due.getByRole("button", { name: ar.today.postpone }).click();
  await expect(due.getByText(ar.today.postponed)).toBeVisible();
  await expect(table.locator("tbody tr").first()).toContainText(ar.today.postponed);
  await due.getByRole("button", { name: ar.today.undoPostpone }).click();
  await tapScore(due, ar.glossary.memorizationRate, 8);
  await tapScore(due, ar.glossary.behaviorRate, 9);
  await expect(table.locator("tbody tr").first()).toContainText("الناس 1–5");
  await expect(table.locator("tbody")).not.toContainText(ar.today.postponed);
  await waitForSynced(page);
});
