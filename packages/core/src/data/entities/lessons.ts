import { v7 as uuidv7 } from "uuid";
import type { LocalDate } from "../../domain/dates/local-date";
import { lessonIdFor } from "../../shared/ids";
import type { LessonRecord } from "../../shared/schemas/lesson";
import type { DataWriter } from "../local-store";
import type { StorageReader } from "../storage";

/** The class's non-deleted lesson on that date, if any. */
export async function findLiveLesson(
  db: StorageReader,
  classId: string,
  date: LocalDate,
): Promise<LessonRecord | undefined> {
  const lessons = await db.query("lessons", "[classId+date]", { equals: [classId, date] });
  return lessons.find((lesson) => lesson.deletedAt === null);
}

/**
 * Opens the class's lesson for `date`, creating it if needed (one lesson per
 * class per day). The id is derived from class + date so two offline devices
 * converge on one record. If that id belongs to a deleted lesson it is
 * revived; if it belongs to a lesson that was moved to another date, a fresh
 * id is used instead.
 */
export function startLesson(
  store: DataWriter,
  classId: string,
  date: LocalDate,
): Promise<LessonRecord> {
  return store.transaction(async (tx) => {
    const live = await findLiveLesson(tx, classId, date);
    if (live) return live;

    const derivedId = lessonIdFor(classId, date);
    const existing = await tx.get("lessons", derivedId);
    if (!existing || existing.deletedAt !== null) {
      return tx.upsert("lessons", derivedId, { classId, date, note: existing?.note ?? "" });
    }
    return tx.create("lessons", { classId, date, note: "" }, { id: uuidv7() });
  });
}

export type ChangeLessonDateResult = { status: "changed" } | { status: "taken" };

/** Moves a lesson to another date, unless the class already has a lesson then. */
export function changeLessonDate(
  store: DataWriter,
  lessonId: string,
  date: LocalDate,
): Promise<ChangeLessonDateResult> {
  return store.transaction(async (tx) => {
    const lesson = await tx.get("lessons", lessonId);
    if (!lesson) throw new Error(`No lesson ${lessonId}`);
    const other = await findLiveLesson(tx, lesson.classId, date);
    if (other && other.id !== lessonId) return { status: "taken" } as const;
    await tx.update("lessons", lessonId, { date });
    return { status: "changed" } as const;
  });
}

/**
 * Soft-deletes a lesson and what was recorded in it, in one transaction:
 * - its attendance is deleted;
 * - homework evaluated in it goes back to pending;
 * - homework assigned in it is deleted, unless it was evaluated in another
 *   lesson (then it stays, so that lesson's history is kept).
 */
export async function deleteLesson(store: DataWriter, lessonId: string) {
  await store.transaction(async (tx) => {
    for (const record of await tx.query("attendance", "lessonId", { equals: lessonId })) {
      if (record.deletedAt === null) await tx.softDelete("attendance", record.id);
    }
    const evaluated = await tx.query("homework", "evaluatedLessonId", { equals: lessonId });
    const assigned = await tx.query("homework", "assignedLessonId", { equals: lessonId });
    for (const item of assigned) {
      if (item.deletedAt !== null) continue;
      if (item.evaluatedLessonId !== null && item.evaluatedLessonId !== lessonId) {
        await tx.update("homework", item.id, { assignedLessonId: null });
      } else {
        await tx.softDelete("homework", item.id);
      }
    }
    for (const item of evaluated) {
      if (item.deletedAt !== null || item.assignedLessonId === lessonId) continue;
      await tx.update("homework", item.id, {
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
      });
    }
    await tx.softDelete("lessons", lessonId);
  });
}
