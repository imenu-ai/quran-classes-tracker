import { validateAyahRange } from "@/domain/quran/validation";
import { parseIntegerInput } from "@/domain/text/digits";
import type { FieldError } from "@/shared/schemas/errors";

export type AyahRangeField = "surah" | "fromAyah" | "toAyah";

/** What the teacher has typed so far. */
export interface AyahRangeDraft {
  surah: number | null;
  /** Raw input text (any digit system). */
  from: string;
  to: string;
}

export type AyahRangeErrors = Partial<Record<AyahRangeField, FieldError>>;

export type AyahRangeCheck =
  | {
      ok: true;
      value: { surah: number; fromAyah: number; toAyah: number };
      errors: AyahRangeErrors;
    }
  | { ok: false; errors: AyahRangeErrors };

const required = (path: AyahRangeField): FieldError => ({ path, code: "REQUIRED", params: {} });

/**
 * Validates a homework portion as it is being typed, with the same rules
 * (and codes) as the shared schema the server enforces: an empty field is
 * REQUIRED, anything else goes through the sura map's validateAyahRange.
 */
export function checkAyahRange(draft: AyahRangeDraft): AyahRangeCheck {
  const errors: AyahRangeErrors = {};
  const fromAyah = parseIntegerInput(draft.from);
  const toAyah = parseIntegerInput(draft.to);

  if (draft.surah === null) errors.surah = required("surah");
  if (fromAyah === undefined) errors.fromAyah = required("fromAyah");
  if (toAyah === undefined) errors.toAyah = required("toAyah");
  if (draft.surah === null || fromAyah === undefined || toAyah === undefined) {
    return { ok: false, errors };
  }

  const result = validateAyahRange(draft.surah, fromAyah, toAyah);
  if (!result.ok) {
    errors[result.field] = { path: result.field, code: result.code, params: result.params };
    return { ok: false, errors };
  }
  return { ok: true, value: { surah: draft.surah, fromAyah, toAyah }, errors };
}
