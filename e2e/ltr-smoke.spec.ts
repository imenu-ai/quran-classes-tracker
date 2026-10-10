import { credentialsFor, E2E_BASE_URL } from "./accounts";
import { en, expect, signIn, test } from "./fixtures";
import { addStudent, createClass } from "./helpers";

/**
 * English (LTR) is built but hidden from users. This smoke test keeps the
 * direction-agnostic layout honest: every main screen renders LTR without
 * horizontal overflow at 360 px.
 */
test("LTR smoke: main screens in English at 360 px", async ({ page, projectName }) => {
  // The ltr accounts are created with locale "en" (see server.mts).
  await page.setViewportSize({ width: 360, height: 740 });
  await signIn(page, credentialsFor("ltr", projectName));

  await createClass(page, "LTR class", en);
  const classUrl = page.url();
  await addStudent(page, "Yusuf Test", "2014", en);
  await page.getByRole("link", { name: /Yusuf Test/ }).click();
  await page.waitForURL(/\/student\?id=/);
  const studentUrl = page.url();

  for (const url of [
    `${E2E_BASE_URL}/`,
    classUrl,
    studentUrl,
    `${E2E_BASE_URL}/search?q=yusuf`,
    `${E2E_BASE_URL}/users`,
    `${E2E_BASE_URL}/users?id=new`,
    `${E2E_BASE_URL}/settings`,
    `${E2E_BASE_URL}/register`,
    `${E2E_BASE_URL}/forgot-password`,
    `${E2E_BASE_URL}/reset-password`,
  ]) {
    await page.goto(url);
    await page.locator("main h1").first().waitFor();
    const layout = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(layout, url).toEqual({ dir: "ltr", lang: "en", overflow: 0 });
  }
});
