import { accountFor } from "./accounts";
import { ar, expect, signIn, test, waitForSynced } from "./fixtures";
import { addStudent, createClass, fill, setPortion, tapScore } from "./helpers";

test("lesson day: class → students → lesson → attendance → evaluate → homework → profile", async ({
  page,
  projectName,
}, testInfo) => {
  await signIn(page, accountFor("main", projectName));

  // First use: empty state invites creating a class.
  await expect(page.getByText(ar.classes.emptyTitle)).toBeVisible();
  await createClass(page, "حلقة الاختبار");
  await addStudent(page, "أحمد التجريبي", "2014");
  await addStudent(page, "سالم التجريبي", "2015");

  // Lesson: attendance.
  await page.getByRole("button", { name: ar.glossary.newLesson }).click();
  await page.waitForURL(/\/lesson\?id=/);
  await page.getByRole("button", { name: ar.attendance.markAllPresent }).click();
  await page
    .locator("main ul > li")
    .filter({ hasText: "سالم التجريبي" })
    .getByRole("radio", { name: ar.glossary.absent, exact: true })
    .click();
  await expect(page.locator("main p[aria-live]")).toContainText(
    fill(ar.lessons.attendanceSummary, { present: 1, absent: 1, excused: 0 }),
  );

  // Evaluation: recite now (no homework yet), score it, assign the next one.
  await page.getByRole("tab", { name: ar.lessons.stepEvaluate }).click();
  const card = page.locator("main article").filter({ hasText: "أحمد التجريبي" });
  await card.getByRole("button", { name: ar.evaluation.reciteNow }).click();
  await setPortion(page, "الفلق", /^113 · الفلق/, "1", "5");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await expect(card.getByText("الفلق 1–5")).toBeVisible();

  const progress = page.locator("main p[aria-live]").first();
  await expect(progress).toHaveText(fill(ar.evaluation.progress, { done: 0, total: 1 }));
  // How quickly a score tap shows as selected, measured in the page so
  // Playwright's own click overhead isn't counted (production build).
  const memorization = card
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
  await tapScore(card, ar.glossary.behaviorRate, 10);
  await expect(progress).toHaveText(fill(ar.evaluation.progress, { done: 1, total: 1 }));

  await card.getByRole("button", { name: ar.evaluation.addNext }).click();
  // Suggested: the next sura after الفلق, same size, clamped to An-Nas.
  await expect(
    page.getByRole("dialog").getByRole("button", { name: ar.glossary.surah }),
  ).toContainText("114 · الناس");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await expect(card.getByText("الناس 1–5")).toBeVisible();
  await waitForSynced(page);

  // Student profile: monthly averages, history and current homework.
  await page.getByRole("link", { name: ar.nav.back }).click();
  await page.waitForURL(/\/class\?id=/);
  await page.getByRole("link", { name: /أحمد التجريبي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  await expect(page.getByText("الناس 1–5")).toBeVisible(); // current homework
  const month = page
    .getByRole("group", { name: ar.profile.selectMonth })
    .getByRole("button")
    .first();
  await expect(month).toContainText("9.0");
  await expect(month).toContainText("10.0");
  await expect(page.getByRole("button", { name: /الفلق 1–5/ })).toBeVisible(); // history row
});
