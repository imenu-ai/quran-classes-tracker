import { normalizeForSearch } from "../../domain/quran/search";
import type { ClassRecord } from "../../shared/schemas/class";
import type { StudentRecord } from "../../shared/schemas/student";
import type { StorageReader } from "../storage";

export interface StudentSearchResult {
  student: StudentRecord;
  className: string | null;
  archived: boolean;
}

/**
 * Finds students by full or partial name, ignoring tashkeel, hamza forms,
 * ة/ه, ى/ي, letter case and spacing. Ranking: name starts with the query,
 * then a word starts with it, then it appears anywhere; active students
 * before archived ones; then by name.
 */
export function searchStudents(
  students: readonly StudentRecord[],
  classes: readonly ClassRecord[],
  query: string,
  locale: string,
): StudentSearchResult[] {
  const needle = normalizeForSearch(query);
  if (needle === "") return [];

  const classNames = new Map(classes.map((cls) => [cls.id, cls.name]));
  const collator = new Intl.Collator(locale);

  const matches: { result: StudentSearchResult; rank: number }[] = [];
  for (const student of students) {
    if (student.deletedAt !== null) continue;
    const full = normalizeForSearch(student.fullName);
    let rank: number | undefined;
    if (full.startsWith(needle)) rank = 0;
    else if (
      student.fullName.split(/\s+/).some((word) => normalizeForSearch(word).startsWith(needle))
    )
      rank = 1;
    else if (full.includes(needle)) rank = 2;
    if (rank === undefined) continue;
    matches.push({
      rank,
      result: {
        student,
        className: classNames.get(student.classId) ?? null,
        archived: student.archivedAt !== null,
      },
    });
  }

  return matches
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(a.result.archived) - Number(b.result.archived) ||
        collator.compare(a.result.student.fullName, b.result.student.fullName),
    )
    .map((match) => match.result);
}

/** Every local student matching the query, ranked (see searchStudents). */
export async function loadStudentSearch(db: StorageReader, query: string, locale: string) {
  const [students, classes] = await Promise.all([db.all("students"), db.all("classes")]);
  return searchStudents(students, classes, query, locale);
}
