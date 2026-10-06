import { getAyahCount, SURAH_COUNT } from "../quran/surahs";

export type Direction = "forward" | "backward";

/** One homework portion: a single sura, from ayah → to ayah. */
export interface Portion {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

/**
 * Pre-fills the next homework (the teacher can change everything).
 *
 * - Continues in the same sura right after `toAyah`, with the same size as
 *   the previous portion, never past the sura's last ayah.
 * - When the sura is finished, moves to the next sura (forward) or the
 *   previous one (backward), starting at ayah 1.
 * - Returns null past sura 114 (forward) or sura 1 (backward).
 * - With no history: nothing for forward; sura 114 (An-Nas) for backward,
 *   where Juz ʿAmma is usually started from the end.
 */
export function suggestNextHomework(
  previous: Portion | null,
  direction: Direction,
): Portion | null {
  if (!previous) {
    if (direction === "forward") return null;
    return { surah: SURAH_COUNT, fromAyah: 1, toAyah: getAyahCount(SURAH_COUNT)! };
  }

  const ayahCount = getAyahCount(previous.surah);
  if (!ayahCount) return null;
  const size = Math.max(1, previous.toAyah - previous.fromAyah + 1);

  if (previous.toAyah < ayahCount) {
    const fromAyah = previous.toAyah + 1;
    return { surah: previous.surah, fromAyah, toAyah: Math.min(ayahCount, fromAyah + size - 1) };
  }

  const nextSurah = previous.surah + (direction === "forward" ? 1 : -1);
  const nextCount = getAyahCount(nextSurah);
  if (!nextCount) return null;
  return { surah: nextSurah, fromAyah: 1, toAyah: Math.min(nextCount, size) };
}

/**
 * The portion to continue from: the student's most recently created
 * homework, pending or evaluated (so assigning after a pending item
 * continues after it). Deleted items are ignored.
 */
export function latestPortion<
  T extends Portion & { createdAt: number; id: string; deletedAt: number | null },
>(homework: readonly T[]): T | null {
  let latest: T | null = null;
  for (const item of homework) {
    if (item.deletedAt !== null) continue;
    if (
      !latest ||
      item.createdAt > latest.createdAt ||
      (item.createdAt === latest.createdAt && item.id > latest.id)
    ) {
      latest = item;
    }
  }
  return latest;
}
