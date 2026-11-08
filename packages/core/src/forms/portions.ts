import { getAyahCount } from "../domain/quran/surahs";
import type { HomeworkPortion } from "../shared/schemas/homework";
import { checkAyahRange, type AyahRangeDraft, type AyahRangeErrors } from "./ayah-range";

/** One sura of a homework being typed: its range, or the whole sura. */
export interface PortionDraft extends AyahRangeDraft {
  /** Stable across adds and removes, for list keys and touched fields. */
  key: string;
  /** "السورة كاملة": ayah 1 to the last; the ayah fields are hidden. */
  whole: boolean;
}

export type PortionsCheck =
  | { ok: true; value: HomeworkPortion[]; errors: AyahRangeErrors[] }
  | { ok: false; errors: AyahRangeErrors[] };

let nextKey = 0;
const newKey = () => `p${++nextKey}`;

export const emptyPortionDraft = (): PortionDraft => ({
  key: newKey(),
  surah: null,
  from: "",
  to: "",
  whole: false,
});

/** Drafts for saved portions; a portion covering its whole sura shows as "whole". */
export function portionDrafts(portions: readonly HomeworkPortion[]): PortionDraft[] {
  if (portions.length === 0) return [emptyPortionDraft()];
  return portions.map((portion) => ({
    key: newKey(),
    surah: portion.surah,
    from: String(portion.fromAyah),
    to: String(portion.toAyah),
    whole: portion.fromAyah === 1 && portion.toAyah === getAyahCount(portion.surah),
  }));
}

/**
 * Validates every sura of a homework as it's typed, with the shared schema's
 * rules (checkAyahRange for each; a whole sura only needs its sura). Errors
 * are per draft, in the same order.
 */
export function checkPortions(drafts: readonly PortionDraft[]): PortionsCheck {
  const value: HomeworkPortion[] = [];
  const errors: AyahRangeErrors[] = [];
  for (const draft of drafts) {
    if (draft.whole) {
      const ayahCount = draft.surah === null ? undefined : getAyahCount(draft.surah);
      if (draft.surah !== null && ayahCount !== undefined) {
        value.push({ surah: draft.surah, fromAyah: 1, toAyah: ayahCount });
        errors.push({});
      } else {
        errors.push({ surah: { path: "surah", code: "REQUIRED", params: {} } });
      }
      continue;
    }
    const check = checkAyahRange(draft);
    errors.push(check.errors);
    if (check.ok) value.push(check.value);
  }
  return value.length === drafts.length && drafts.length > 0
    ? { ok: true, value, errors }
    : { ok: false, errors };
}
