import { notMemorizedIn, type NotMemorizedEntry } from "../../shared/schemas/homework";

interface ProgressHomework {
  studentId: string;
  evaluatedLessonId: string | null;
  memorizationRate: number | null;
  behaviorRate: number | null;
  notMemorized?: readonly NotMemorizedEntry[];
  postponedLessonIds?: readonly string[];
  deletedAt: number | null;
}

/**
 * "تم تقييم X من Y" for a lesson. Y = students present. A present student
 * counts as evaluated when at least one item was evaluated in this lesson or
 * marked "not memorized" in it, every evaluated item has both scores, and
 * every "not memorized" one has a behavior mark. Pending items the student
 * didn't recite today don't hold them back.
 */
export function evaluationProgress(
  presentStudentIds: readonly string[],
  homework: readonly ProgressHomework[],
  lessonId: string,
): { done: number; total: number } {
  const live = homework.filter((item) => item.deletedAt === null);
  let done = 0;
  for (const studentId of new Set(presentStudentIds)) {
    const items = live.filter((item) => item.studentId === studentId);
    const evaluated = items.filter((item) => item.evaluatedLessonId === lessonId);
    const failed = items.flatMap((item) => notMemorizedIn(item, lessonId) ?? []);
    if (
      evaluated.length + failed.length > 0 &&
      evaluated.every((i) => i.memorizationRate !== null && i.behaviorRate !== null) &&
      failed.every((entry) => entry.behaviorRate !== null)
    ) {
      done += 1;
    }
  }
  return { done, total: new Set(presentStudentIds).size };
}

export interface LessonHomeworkItem extends ProgressHomework {
  assignedLessonId: string | null;
}

export interface StudentLessonHomework<T> {
  /** Pending items assigned before this lesson (or never assigned to one). */
  toRecite: T[];
  /** Items evaluated in this lesson (including "recite now"). */
  evaluatedHere: T[];
  /** Assigned in this lesson for the next one, not evaluated yet. */
  nextHomework: T[];
}

/**
 * Splits a student's homework for one lesson. `lessonDates` maps lesson ids
 * to their dates so an old lesson doesn't offer homework assigned later.
 */
export function splitLessonHomework<T extends LessonHomeworkItem>(
  items: readonly T[],
  lesson: { id: string; date: string },
  lessonDates: ReadonlyMap<string, string>,
): StudentLessonHomework<T> {
  const result: StudentLessonHomework<T> = { toRecite: [], evaluatedHere: [], nextHomework: [] };
  for (const item of items) {
    if (item.deletedAt !== null) continue;
    if (item.evaluatedLessonId === lesson.id) {
      result.evaluatedHere.push(item);
    } else if (item.evaluatedLessonId === null) {
      if (item.assignedLessonId === lesson.id) {
        result.nextHomework.push(item);
      } else {
        const assignedDate = item.assignedLessonId
          ? lessonDates.get(item.assignedLessonId)
          : undefined;
        if (assignedDate === undefined || assignedDate < lesson.date) result.toRecite.push(item);
      }
    }
  }
  return result;
}
