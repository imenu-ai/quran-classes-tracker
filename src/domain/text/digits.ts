/**
 * Converts Arabic-Indic (٠–٩) and Eastern Arabic-Indic (۰–۹) digits to
 * Western digits. Arabic keyboards (e.g. on iPhone) may type either.
 */
export function toWesternDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * Parses a whole-number form input. Returns undefined for an empty field
 * (so validation reports REQUIRED) and NaN for anything that isn't a number.
 */
export function parseIntegerInput(text: string): number | undefined {
  const normalized = toWesternDigits(text).trim();
  if (normalized === "") return undefined;
  return /^-?[0-9]+$/.test(normalized) ? Number(normalized) : Number.NaN;
}
