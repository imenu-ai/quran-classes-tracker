import { credentialsFor } from "./accounts";
import { ar, expect, signIn, test, waitForSynced } from "./fixtures";
import {
  addStudent,
  createClass,
  openHomework,
  openMonthTable,
  setPortion,
  setScore,
} from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Two days with one class: day one, a student recites on the spot, gets
 * marks and homework for the next day; another is absent. Day two, the
 * homework is due: postponed, undone, then marked, and an exam is recorded.
 * The month table shows it all.
 */
test("class → students → student page: mark, next-day homework, absence, postpone, exam", async ({
  page,
  projectName,
  browserName,
}) => {
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

  // An item just recited on the spot opens by itself.
  await setScore(today, ar.glossary.memorizationRate, 9);
  await setScore(today, ar.glossary.behaviorRate, 10);

  // Homework for the next day: suggested after الفلق, clamped to An-Nas.
  await today.getByRole("button", { name: ar.today.addNext }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: ar.glossary.surah }),
  ).toContainText("114 · الناس");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await expect(today.getByText("الناس 1–5")).toBeVisible();

  // The month table starts closed, showing the month's averages; opened, it
  // has today's row and the averages again.
  await expect(page.locator("#month-title")).toContainText("9.0");
  await expect(page.locator("#month-title")).toContainText("10.0");
  await expect(page.locator("main table")).toHaveCount(0);
  await openMonthTable(page);
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
  await openMonthTable(page);
  await expect(table.locator("tbody tr").first()).toContainText(ar.glossary.absent);
  await waitForSynced(page);

  // Day two, أحمد: yesterday's homework is due. Postpone, undo, then mark it.
  await page.clock.setSystemTime(Date.now() + DAY_MS);
  await page.goto(classUrl);
  await page.getByRole("link", { name: /أحمد التجريبي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  await openMonthTable(page);
  // Due items start closed: open it first.
  const due = await openHomework(today, "الناس 1–5");
  await due.getByRole("button", { name: ar.today.postpone }).click();
  await expect(due.getByText(ar.today.postponed)).toBeVisible();
  await expect(table.locator("tbody tr").first()).toContainText(ar.today.postponed);
  await due.getByRole("button", { name: ar.today.undoPostpone }).click();
  await setScore(due, ar.glossary.memorizationRate, 8);
  await setScore(due, ar.glossary.behaviorRate, 9);
  await expect(table.locator("tbody tr").first()).toContainText("الناس 1–5");
  await expect(table.locator("tbody")).not.toContainText(ar.today.postponed);
  await expect(table.locator("tfoot")).toContainText("8.5");
  await expect(table.locator("tfoot")).toContainText("9.5");

  // An exam, added and marked on the spot: its own tinted row with a badge
  // and one mark, left out of the averages.
  await today.getByRole("button", { name: ar.exam.add }).click();
  await setPortion(page, "الملك", /^67 · الملك/, "1", "10");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await setScore(today.locator("li").filter({ hasText: "الملك 1–10" }), ar.exam.mark, 3);
  const examRow = table.locator("tbody tr").filter({ hasText: "الملك 1–10" });
  await expect(examRow).toContainText(ar.exam.badge);
  await expect(examRow).toContainText("3");
  await expect(examRow).toHaveClass(/bg-exam/);
  await expect(table.locator("tfoot")).toContainText("8.5");
  await expect(table.locator("tfoot")).toContainText("9.5");
  await waitForSynced(page);

  // Print his month: an A4 sheet naming the center, class, student and the
  // teacher, with the month's rows.
  await page.getByRole("link", { name: ar.print.printMonth }).click();
  await page.waitForURL(/\/print\?/);
  const sheets = page.locator("article.print-sheet");
  await expect(sheets).toHaveCount(1);
  await expect(sheets.first()).toContainText(
    `center-${credentialsFor("main", projectName).username}`,
  );
  await expect(sheets.first()).toContainText("حلقة الاختبار");
  await expect(sheets.first()).toContainText("أحمد التجريبي");
  await expect(sheets.first()).toContainText("معلم الاختبار");
  await expect(sheets.first()).toContainText("الناس 1–5");
  await expect(sheets.first()).toContainText(ar.exam.badge);
  await expect(page.getByRole("button", { name: ar.print.printButton })).toBeVisible();
  await page.getByRole("button", { name: ar.nav.back }).click();
  await page.waitForURL(/\/student\?id=/);

  // The class statistics: أحمد attended both days, سالم neither (absent, then
  // not recorded), so أحمد ranks first; the class attended 2 of 4 possible days.
  await page.goto(classUrl);
  await page.getByRole("link", { name: ar.classStats.button }).click();
  await page.waitForURL(/\/class-stats\?id=/);
  const ranked = page.locator("main ol > li");
  await expect(ranked).toHaveCount(2);
  await expect(ranked.nth(0)).toContainText("أحمد التجريبي");
  // Arabic percentages carry invisible direction marks around "%".
  await expect(ranked.nth(0)).toContainText(/100\W*%/);
  // Averages without the exam.
  await expect(ranked.nth(0)).toContainText("8.5");
  await expect(ranked.nth(0)).toContainText("9.5");
  await expect(ranked.nth(1)).toContainText("سالم التجريبي");
  await expect(ranked.nth(1)).toContainText(/\b0\W*%/);
  await expect(page.locator("main section").first()).toContainText(/50\W*%/);

  // Print both students' sheets: everyone starts selected; "select all"
  // clears and selects them in one tap.
  await page.getByRole("button", { name: ar.print.printStudents }).click();
  const drawer = page.getByRole("dialog");
  const selectAll = drawer.getByRole("checkbox", { name: new RegExp(ar.print.selectAll) });
  await expect(selectAll).toBeChecked();
  await selectAll.uncheck();
  await expect(drawer.getByRole("button", { name: ar.print.show })).toBeDisabled();
  await selectAll.check();
  await expect(drawer.getByRole("checkbox", { name: "سالم التجريبي" })).toBeChecked();
  await drawer.getByRole("button", { name: ar.print.show }).click();
  await page.waitForURL(/\/print\?/);
  await expect(sheets).toHaveCount(2);
  await expect(sheets.nth(0)).toContainText("أحمد التجريبي");
  await expect(sheets.nth(1)).toContainText("سالم التجريبي");
  // Chromium can save the PDF here: one A4 page per student.
  if (browserName === "chromium") {
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(2);
  }
});
