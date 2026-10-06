import { useLiveQuery } from "dexie-react-hooks";
import { v7 as uuidv7 } from "uuid";
import type { LocalDate } from "@/domain/dates/local-date";
import { lessonIdFor } from "@/shared/ids";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { useApp } from "../app-context";
import type { LocalDb } from "../db/dexie";
import type { LocalStore } from "../db/local-store";

const lessonTables = (db: LocalDb) => [db.lessons, db.outbox, db.rejected, db.meta];

/** The class's non-deleted lesson on that date, if any. */
export async function findLiveLesson(
  db: LocalDb,
  classId: string,
  date: LocalDate,
): Promise<LessonRecord | undefined> {
  const lessons = await db.lessons.where("[classId+date]").equals([classId, date]).toArray();
  return lessons.find((lesson) => lesson.deletedAt === null);
}

/**
 * Opens the class's lesson for `date`, creating it if needed (one lesson per
 * class per day). The id is derived from class + date so two offline devices
 * converge on one record. If that id belongs to a deleted lesson it is
 * revived; if it belongs to a lesson that was moved to another date, a fresh
 * id is used instead.
 */
export async function startLesson(
  store: LocalStore,
  classId: string,
  date: LocalDate,
): Promise<LessonRecord> {
  const { db } = store;
  return db.transaction("rw", lessonTables(db), async () => {
    const live = await findLiveLesson(db, classId, date);
    if (live) return live;

    const derivedId = lessonIdFor(classId, date);
    const existing = await db.lessons.get(derivedId);
    if (!existing || existing.deletedAt !== null) {
      return store.upsert("lessons", derivedId, { classId, date, note: existing?.note ?? "" });
    }
    return store.create("lessons", { classId, date, note: "" }, { id: uuidv7() });
  });
}

export type ChangeLessonDateResult = { status: "changed" } | { status: "taken" };

/** Moves a lesson to another date, unless the class already has a lesson then. */
export async function changeLessonDate(
  store: LocalStore,
  lessonId: string,
  date: LocalDate,
): Promise<ChangeLessonDateResult> {
  const { db } = store;
  return db.transaction("rw", lessonTables(db), async () => {
    const lesson = await db.lessons.get(lessonId);
    if (!lesson) throw new Error(`No lesson ${lessonId}`);
    const other = await findLiveLesson(db, lesson.classId, date);
    if (other && other.id !== lessonId) return { status: "taken" } as const;
    await store.update("lessons", lessonId, { date });
    return { status: "changed" } as const;
  });
}

export function setLessonNote(store: LocalStore, lessonId: string, note: string) {
  return store.update("lessons", lessonId, { note });
}

export function useLesson(id: string | null) {
  const { db } = useApp();
  // null = not found, undefined = still loading.
  return useLiveQuery(async () => (id ? ((await db.lessons.get(id)) ?? null) : null), [db, id]);
}

/** A class's lessons, newest first (deleted ones excluded). */
export function useClassLessons(classId: string | null) {
  const { db } = useApp();
  return useLiveQuery(async () => {
    if (!classId) return [];
    const lessons = await db.lessons.where("classId").equals(classId).toArray();
    return lessons
      .filter((lesson) => lesson.deletedAt === null)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db, classId]);
}

/**
 * Soft-deletes a lesson and what was recorded in it, in one transaction:
 * - its attendance is deleted;
 * - homework evaluated in it goes back to pending;
 * - homework assigned in it is deleted, unless it was evaluated in another
 *   lesson (then it stays, so that lesson's history is kept).
 */
export async function deleteLesson(store: LocalStore, lessonId: string) {
  const { db } = store;
  const tables = [db.lessons, db.attendance, db.homework, db.outbox, db.rejected, db.meta];
  await db.transaction("rw", tables, async () => {
    for (const record of await db.attendance.where("lessonId").equals(lessonId).toArray()) {
      if (record.deletedAt === null) await store.softDelete("attendance", record.id);
    }
    const evaluated = await db.homework.where("evaluatedLessonId").equals(lessonId).toArray();
    const assigned = await db.homework.where("assignedLessonId").equals(lessonId).toArray();
    for (const item of assigned) {
      if (item.deletedAt !== null) continue;
      if (item.evaluatedLessonId !== null && item.evaluatedLessonId !== lessonId) {
        await store.update("homework", item.id, { assignedLessonId: null });
      } else {
        await store.softDelete("homework", item.id);
      }
    }
    for (const item of evaluated) {
      if (item.deletedAt !== null || item.assignedLessonId === lessonId) continue;
      await store.update("homework", item.id, {
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
      });
    }
    await store.softDelete("lessons", lessonId);
  });
}

export interface LessonSummary {
  lesson: LessonRecord;
  present: number;
  absent: number;
  excused: number;
  evaluated: number;
}

/** A class's lessons (newest first) with attendance and evaluation counts. */
export function useClassLessonSummaries(classId: string | null) {
  const { db } = useApp();
  return useLiveQuery(async (): Promise<LessonSummary[]> => {
    if (!classId) return [];
    const lessons = (await db.lessons.where("classId").equals(classId).toArray())
      .filter((lesson) => lesson.deletedAt === null)
      .sort((a, b) => b.date.localeCompare(a.date));
    const ids = lessons.map((lesson) => lesson.id);
    const [attendance, homework] = await Promise.all([
      db.attendance.where("lessonId").anyOf(ids).toArray(),
      db.homework.where("evaluatedLessonId").anyOf(ids).toArray(),
    ]);
    return lessons.map((lesson) => {
      const live = attendance.filter((a) => a.lessonId === lesson.id && a.deletedAt === null);
      return {
        lesson,
        present: live.filter((a) => a.status === "present").length,
        absent: live.filter((a) => a.status === "absent").length,
        excused: live.filter((a) => a.status === "excused").length,
        evaluated: homework.filter((h) => h.evaluatedLessonId === lesson.id && h.deletedAt === null)
          .length,
      };
    });
  }, [db, classId]);
}
