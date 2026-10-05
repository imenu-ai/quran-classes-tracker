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
