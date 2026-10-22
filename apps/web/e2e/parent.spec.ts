import { credentialsFor, E2E_BASE_URL } from "./accounts";
import { ar, expect, newContext, signIn, test, waitForSynced } from "./fixtures";
import { addStudent, createClass, openMonthTable, setPortion, setScore } from "./helpers";

/**
 * The parent link: the teacher sets أحمد's parent ID and marks him (homework
 * and an exam); a parent's phone, not signed in, opens his link with the ID
 * number and sees his month. سالم has no parent ID: his link isn't valid.
 * The printed sheet carries the link as a QR code.
 */
test("parent link: ID number, the month, remembered phone, invalid link, printed QR", async ({
  page,
  browser,
  projectName,
}) => {
  const account = credentialsFor("parent", projectName);
  await signIn(page, account);
  await createClass(page, "حلقة الأهالي");
  const classUrl = page.url();
  await addStudent(page, "أحمد الأهالي", "2014");
  await addStudent(page, "سالم الأهالي", "2015");

  // سالم's page: his id only (no parent ID).
  await page.getByRole("link", { name: /سالم الأهالي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  const salemId = new URL(page.url()).searchParams.get("id")!;

  // أحمد: the parent ID, typed in Arabic digits, then a mark and an exam today.
  await page.goto(classUrl);
  await page.getByRole("link", { name: /أحمد الأهالي/ }).click();
  await page.waitForURL(/\/student\?id=/);
  await page.getByRole("button", { name: ar.students.actions }).click();
  await page.getByRole("menuitem", { name: ar.students.edit }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: ar.students.parentId })
    .fill("٤٠١٢٣٤٥٦٧");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const today = page.locator("section[aria-labelledby=today-title]");
  await today.getByRole("button", { name: ar.evaluation.reciteNow }).click();
  await setPortion(page, "الفلق", /^113 · الفلق/, "1", "5");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await setScore(today, ar.glossary.memorizationRate, 9);
  await setScore(today, ar.glossary.behaviorRate, 8);
  await today.getByRole("button", { name: ar.exam.add }).click();
  await setPortion(page, "الملك", /^67 · الملك/, "1", "10");
  await page.getByRole("dialog").getByRole("button", { name: ar.common.save }).click();
  await setScore(today.locator("li").filter({ hasText: "الملك 1–10" }), ar.exam.mark, 4);

  // The link, from the student menu.
  await page.getByRole("button", { name: ar.students.actions }).click();
  await page.getByRole("menuitem", { name: ar.parentLink.menu }).click();
  const drawer = page.getByRole("dialog");
  const link = (await drawer.getByText(/\/parent\?s=/).textContent())!.trim();
  expect(link).toContain(`/parent?s=`);
  await expect(drawer.getByRole("img", { name: ar.parentLink.qr })).toHaveAttribute(
    "data-qr-value",
    link,
  );
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await waitForSynced(page);

  // The printed sheet carries the same link as a QR code.
  await openMonthTable(page);
  await page.getByRole("link", { name: ar.print.printMonth }).click();
  await page.waitForURL(/\/print\?/);
  await expect(
    page.locator("article.print-sheet").getByRole("img", { name: ar.print.qrCaption }),
  ).toHaveAttribute("data-qr-value", link);

  // A parent's phone: not signed in.
  const parentContext = await newContext(browser, { viewport: page.viewportSize() ?? undefined });
  const parent = await parentContext.newPage();

  await parent.goto(link);
  const idBox = parent.getByRole("textbox", { name: ar.parent.parentId });
  await idBox.fill("123456789");
  await parent.getByRole("button", { name: ar.parent.show }).click();
  await expect(parent.getByText(ar.parent.wrong)).toBeVisible();

  await idBox.fill("401234567");
  await parent.getByRole("button", { name: ar.parent.show }).click();
  await expect(parent.getByRole("heading", { level: 1 })).toHaveText("أحمد الأهالي");
  await expect(parent.locator("header")).toContainText(`center-${account.username}`);
  await expect(parent.locator("header")).toContainText("حلقة الأهالي");
  const rows = parent.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("الفلق 1–5");
  await expect(rows.nth(1)).toContainText(ar.exam.badge);
  // The exam is left out of the averages.
  const summary = parent.getByRole("region", { name: ar.profile.average });
  await expect(summary).toContainText("9.0");
  await expect(summary).toContainText("8.0");

  // Another month (from the URL), then back with the picker.
  const current = await parent.getByRole("combobox", { name: ar.print.month }).inputValue();
  const [year, month] = current.split("-").map(Number) as [number, number];
  const previous = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  await parent.goto(`${parent.url()}&month=${previous}`);
  await expect(parent.getByText(ar.profile.noHistory)).toBeVisible();
  await parent.getByRole("combobox", { name: ar.print.month }).selectOption(current);
  await expect(rows).toHaveCount(2);

  // The phone is remembered, until "sign out on this device".
  await parent.reload();
  await expect(rows).toHaveCount(2);
  await parent.getByRole("button", { name: ar.parent.forget }).click();
  await expect(idBox).toBeVisible();
  await parent.reload();
  await expect(idBox).toBeVisible();

  // سالم has no parent ID: his link isn't valid.
  await parent.goto(`${E2E_BASE_URL}/parent?s=${salemId}`);
  await expect(parent.getByText(ar.parent.invalidTitle)).toBeVisible();
  await parentContext.close();
});
