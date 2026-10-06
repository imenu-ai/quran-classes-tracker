import type { Page } from "@playwright/test";
import { ar, expect } from "./fixtures";

/** Fills a simple ICU message's {placeholders} (no plural/select). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export async function createClass(page: Page, name: string, messages = ar) {
  await page.getByRole("button", { name: messages.classes.create }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: messages.classes.name }).fill(name);
  await dialog.getByRole("button", { name: messages.classes.create }).click();
  await page.waitForURL(/\/class\?id=/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

export async function addStudent(page: Page, fullName: string, birthYear: string, messages = ar) {
  await page.getByRole("button", { name: messages.students.add }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: messages.students.fullName, exact: true })
    .fill(fullName);
  await dialog.getByRole("textbox", { name: messages.students.birthYear }).fill(birthYear);
  await dialog.getByRole("button", { name: messages.students.add }).click();
  await expect(page.getByRole("link", { name: new RegExp(fullName) })).toBeVisible();
}

/** Opens the sura picker in the homework sheet, picks a sura, sets the range. */
export async function setPortion(
  page: Page,
  search: string,
  option: RegExp,
  from: string,
  to: string,
) {
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: ar.glossary.surah }).click();
  await page.getByRole("combobox").fill(search);
  await page.getByRole("option", { name: option }).click();
  await sheet.getByRole("textbox", { name: ar.glossary.fromAyah, exact: true }).fill(from);
  await sheet.getByRole("textbox", { name: ar.glossary.toAyah, exact: true }).fill(to);
}

/** Taps a score in one of an evaluation card's 1–10 grids. */
export async function tapScore(
  scope: import("@playwright/test").Locator,
  group: string,
  score: number,
) {
  await scope
    .getByRole("group", { name: group })
    .first()
    .getByRole("button", { name: String(score), exact: true })
    .click();
}
