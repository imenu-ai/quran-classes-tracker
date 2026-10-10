import type { Portion } from "@/domain/homework/suggestion";
import { postponedLessonsOf, type HomeworkRecord } from "@/shared/schemas/homework";
import type { LocalDb } from "../db/dexie";
import type { LocalStore } from "../db/local-store";
import type { AttendanceStatus } from "@/shared/schemas/attendance";
import { findAttendance, setAttendance } from "./attendance";

const homeworkTables = (db: LocalDb) => [
  db.homework,
  db.attendance,
  // Read when evaluating marks the student present (attendance takes the lesson's class).
  db.lessons,
  db.outbox,
  db.rejected,
  db.meta,
];

/** Evaluating a student who isn't marked yet marks them present. */
async function ensurePresent(store: LocalStore, lessonId: string, studentId: string) {
  const record = await findAttendance(store.db, lessonId, studentId);
  if (!record || record.deletedAt !== null) {
    await setAttendance(store, lessonId, studentId, "present");
  }
}

export type RateField = "memorizationRate" | "behaviorRate";

/**
 * Sets (or clears, with null) one score; the item becomes evaluated in this
 * lesson. Scoring after a postponement in the same lesson replaces it.
 */
export async function rateHomework(
  store: LocalStore,
  item: Pick<HomeworkRecord, "id" | "studentId">,
  lessonId: string,
  field: RateField,
  score: number | null,
) {
  const { db } = store;
  await db.transaction("rw", homeworkTables(db), async () => {
    await ensurePresent(store, lessonId, item.studentId);
    const current = await db.homework.get(item.id);
    const postponed = current ? postponedLessonsOf(current) : [];
    await store.update("homework", item.id, {
      evaluatedLessonId: lessonId,
      [field]: score,
      ...(postponed.includes(lessonId)
        ? { postponedLessonIds: postponed.filter((id) => id !== lessonId) }
        : {}),
    });
  });
}

/**
 * Postpones the recitation ("تأجيل التسميع"): the student wasn't ready. The
 * item stays pending for the next day, the student counts as present, and
 * nothing is scored. Only for items not evaluated yet.
 */
export async function postponeHomework(
  store: LocalStore,
  item: Pick<HomeworkRecord, "id" | "studentId">,
  lessonId: string,
) {
  const { db } = store;
  await db.transaction("rw", homeworkTables(db), async () => {
    const current = await db.homework.get(item.id);
    if (!current || current.deletedAt !== null || current.evaluatedLessonId !== null) return;
    const postponed = postponedLessonsOf(current);
    if (postponed.includes(lessonId)) return;
    await ensurePresent(store, lessonId, item.studentId);
    await store.update("homework", item.id, { postponedLessonIds: [...postponed, lessonId] });
  });
}

/**
 * Sets a student's attendance in a lesson. A postponed recitation means he
 * was there, so marking him absent or excused also cancels his
 * postponements in that lesson.
 */
export async function setStudentAttendance(
  store: LocalStore,
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
) {
  const { db } = store;
  await db.transaction("rw", homeworkTables(db), async () => {
    await setAttendance(store, lessonId, studentId, status);
    if (status === "present") return;
    const items = await db.homework.where("studentId").equals(studentId).toArray();
    for (const item of items) {
      const postponed = postponedLessonsOf(item);
      if (item.deletedAt !== null || !postponed.includes(lessonId)) continue;
      await store.update("homework", item.id, {
        postponedLessonIds: postponed.filter((id) => id !== lessonId),
      });
    }
  });
}

/** Undoes a postponement made in this lesson. */
export async function undoPostpone(
  store: LocalStore,
  item: Pick<HomeworkRecord, "id">,
  lessonId: string,
) {
  const { db } = store;
  await db.transaction("rw", homeworkTables(db), async () => {
    const current = await db.homework.get(item.id);
    if (!current) return;
    const postponed = postponedLessonsOf(current);
    if (!postponed.includes(lessonId)) return;
    await store.update("homework", item.id, {
      postponedLessonIds: postponed.filter((id) => id !== lessonId),
    });
  });
}

/**
 * Undoes an evaluation made in this lesson. An item created here to be
 * recited on the spot ("تسميع الآن") is removed; any other goes back to pending.
 */
export async function undoEvaluation(store: LocalStore, item: HomeworkRecord, lessonId: string) {
  if (item.assignedLessonId === lessonId) {
    await store.softDelete("homework", item.id);
  } else {
    await store.update("homework", item.id, {
      evaluatedLessonId: null,
      memorizationRate: null,
      behaviorRate: null,
    });
  }
}

/**
 * Adds homework in this lesson: for the next lesson, or (evaluateNow) to be
 * recited and scored right away.
 */
export async function addHomework(
  store: LocalStore,
  input: {
    studentId: string;
    lessonId: string;
    portion: Portion;
    note: string;
    evaluateNow: boolean;
  },
) {
  const { db } = store;
  return db.transaction("rw", homeworkTables(db), async () => {
    if (input.evaluateNow) await ensurePresent(store, input.lessonId, input.studentId);
    return store.create("homework", {
      studentId: input.studentId,
      ...input.portion,
      note: input.note,
      assignedLessonId: input.lessonId,
      evaluatedLessonId: input.evaluateNow ? input.lessonId : null,
      memorizationRate: null,
      behaviorRate: null,
      postponedLessonIds: [],
    });
  });
}

/** Edits the portion (e.g. the student recited only part of it). */
export function updateHomework(store: LocalStore, id: string, portion: Portion, note: string) {
  return store.update("homework", id, { ...portion, note });
}

export function deleteHomework(store: LocalStore, id: string) {
  return store.softDelete("homework", id);
}
