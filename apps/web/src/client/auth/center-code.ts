import { toWesternDigits } from "@/domain/text/digits";

const KEY = "qct:center-code";

/** The center code as typed: Arabic-Indic digits accepted, spaces removed. */
export function normalizeCenterCode(raw: string): string {
  return toWesternDigits(raw).replace(/\s+/g, "");
}

/**
 * The last center code used on this device, so teachers type it once. Only
 * a convenience: storage may be unavailable (private mode), so never rely on it.
 */
export function readRememberedCenterCode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberCenterCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Not remembered; the form still works.
  }
}
