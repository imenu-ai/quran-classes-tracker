import { E2E_BASE_URL } from "./accounts";
import { ar, expect, newContext, test, waitForSynced } from "./fixtures";
import { addStudent, createClass } from "./helpers";

/**
 * Centers and roles: an admin registers, sets up two classes and a teacher
 * who may only run lessons in one of them; the teacher's device follows when
 * the admin changes that, and a disabled teacher can't sign in.
 */
test("admin registers, adds a teacher with limited access, and changes it", async ({
  page,
  browser,
  projectName,
}) => {
  // 1. Register the center (its own admin).
  await page.goto(`${E2E_BASE_URL}/register`);
  await expect(page.locator("select[name=timezone]")).toBeEnabled();
  await page.getByLabel(ar.auth.register.centerName).fill("مركز الأدوار");
  await page.getByLabel(ar.auth.register.adminName).fill("المدير");
  await page.getByLabel(ar.auth.register.email).fill(`roles-${projectName}-${Date.now()}@e2e.test`);
  await page.getByLabel(ar.auth.register.username).fill("admin");
  await page.getByLabel(ar.auth.register.password).fill("admin-password-1");
  await page.getByRole("button", { name: ar.auth.register.submit }).click();
  const code = (await page.locator("output").textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  await page.getByRole("button", { name: ar.auth.register.done.continue }).click();
  await page.waitForURL(`${E2E_BASE_URL}/`);

  // 2. Two classes with a student each.
  await createClass(page, "حلقة الصباح");
  await addStudent(page, "طالب الصباح", "2014");
  await page.goto(`${E2E_BASE_URL}/`);
  await createClass(page, "حلقة المساء");
  await addStudent(page, "طالب المساء", "2015");
  await waitForSynced(page);

  // 3. A teacher who may run lessons in the morning class only.
  await page.getByRole("link", { name: ar.nav.users }).first().click();
  await page.getByRole("link", { name: ar.users.add }).click();
  await page.getByLabel(ar.users.name, { exact: true }).fill("الأستاذ سالم");
  await page.getByLabel(ar.users.username).fill("salem");
  await page.getByLabel(ar.users.password).fill("temp-pass-1");
  await page.getByLabel(ar.users.permissions.reportsView).uncheck();
  await page.getByLabel("حلقة الصباح").check();
  await page.getByRole("button", { name: ar.users.create }).click();
  await expect(page.getByRole("link", { name: /الأستاذ سالم/ })).toContainText(
    ar.users.statusMustChange,
  );

  // 4. The teacher's own device: center code + username + password, then
  //    he must replace the password the admin chose.
  const teacherContext = await newContext(browser);
  const teacher = await teacherContext.newPage();
  await teacher.goto(`${E2E_BASE_URL}/login`);
  await teacher.locator('input[name="code"]').fill(code);
  await teacher.locator('input[name="username"]').fill("salem");
  await teacher.locator('input[name="password"]').fill("temp-pass-1");
  await teacher.locator('button[type="submit"]').click();
  await teacher.waitForURL(/\/change-password/);
  await teacher.getByLabel(ar.settings.currentPassword).fill("temp-pass-1");
  await teacher.getByLabel(ar.settings.newPassword, { exact: true }).fill("salem-own-pass");
  await teacher.getByLabel(ar.settings.confirmPassword).fill("salem-own-pass");
  await teacher.getByRole("button", { name: ar.auth.changePassword.submit }).click();
  await teacher.waitForURL(`${E2E_BASE_URL}/`);
  await waitForSynced(teacher);

  // Only his class, and only what his permissions allow.
  await expect(teacher.getByRole("link", { name: /حلقة الصباح/ })).toBeVisible();
  await expect(teacher.getByRole("link", { name: /حلقة المساء/ })).toHaveCount(0);
  await expect(teacher.getByRole("button", { name: ar.classes.create })).toHaveCount(0);
  await expect(teacher.getByRole("link", { name: ar.nav.users })).toHaveCount(0);
  await teacher
    .getByRole("link", { name: /حلقة الصباح/ })
    .first()
    .click();
  await expect(teacher.getByRole("link", { name: /طالب الصباح/ })).toBeVisible();
  await expect(teacher.getByRole("button", { name: ar.students.add })).toHaveCount(0);
  // He may run lessons: the student's page lets him mark today.
  await teacher.getByRole("link", { name: /طالب الصباح/ }).click();
  await teacher.waitForURL(/\/student\?id=/);
  await expect(teacher.getByRole("button", { name: ar.evaluation.reciteNow })).toBeEnabled();

  // 5. The admin moves him to the evening class; his device follows.
  await page.getByRole("link", { name: /الأستاذ سالم/ }).click();
  await page.getByLabel("حلقة الصباح").uncheck();
  await page.getByLabel("حلقة المساء").check();
  await page.getByRole("button", { name: ar.users.save }).click();
  await page.waitForURL(`${E2E_BASE_URL}/users`);

  await teacher.goto(`${E2E_BASE_URL}/`);
  await expect(teacher.getByRole("link", { name: /حلقة المساء/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(teacher.getByRole("link", { name: /حلقة الصباح/ })).toHaveCount(0);

  // 6. Disabled: he can't sign in any more.
  await page.getByRole("link", { name: /الأستاذ سالم/ }).click();
  await page.getByRole("button", { name: ar.users.disable }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: ar.users.disable }).click();
  await expect(page.getByText(ar.users.disabledToast)).toBeVisible();

  await teacherContext.clearCookies();
  const again = await teacherContext.newPage();
  await again.goto(`${E2E_BASE_URL}/login`);
  await again.locator('input[name="code"]').fill(code);
  await again.locator('input[name="username"]').fill("salem");
  await again.locator('input[name="password"]').fill("salem-own-pass");
  await again.locator('button[type="submit"]').click();
  await expect(again.locator("form [role=alert]")).toHaveText(ar.auth.errors.accountDisabled);
  await teacherContext.close();
});
