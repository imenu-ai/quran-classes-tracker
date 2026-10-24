import type { Portion } from "../../domain/homework/suggestion";
import type { AttendanceStatus } from "../../shared/schemas/attendance";
import { postponedLessonsOf, type HomeworkRecord } from "../../shared/schemas/homework";
import type { DataWriter } from "../local-store";
import { findAttendance, setAttendance } from "./attendance";

/** Evaluating a student who isn't marked yet marks them present. */
async function ensurePresent(tx: DataWriter, lessonId: string, studentId: string) {
  const record = await findAttendance(tx, lessonId, studentId);
  if (!record || record.deletedAt !== null) {
    await setAttendance(tx, lessonId, studentId, "present");
  }
}

export type RateField = "memorizationRate" | "behaviorRate";

/**
 * Sets (or clears, with null) one score; the item becomes evaluated in this
 * lesson. Scoring after a postponement in the same lesson replaces it.
 */
export async function rateHomework(
  store: DataWriter,
  item: Pick<HomeworkRecord, "id" | "studentId">,
  lessonId: string,
  field: RateField,
  score: number | null,
) {
  await store.transaction(async (tx) => {
    await ensurePresent(tx, lessonId, item.studentId);
    const current = await tx.get("homework", item.id);
    const postponed = current ? postponedLessonsOf(current) : [];
    await tx.update("homework", item.id, {
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
  store: DataWriter,
  item: Pick<HomeworkRecord, "id" | "studentId">,
  lessonId: string,
) {
  await store.transaction(async (tx) => {
    const current = await tx.get("homework", item.id);
    if (!current || current.deletedAt !== null || current.evaluatedLessonId !== null) return;
    const postponed = postponedLessonsOf(current);
    if (postponed.includes(lessonId)) return;
    await ensurePresent(tx, lessonId, item.studentId);
    await tx.update("homework", item.id, { postponedLessonIds: [...postponed, lessonId] });
  });
}

/**
 * Sets a student's attendance in a lesson. A postponed recitation means he
 * was there, so marking him absent or excused also cancels his
 * postponements in that lesson.
 */
export async function setStudentAttendance(
  store: DataWriter,
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
) {
  await store.transaction(async (tx) => {
    await setAttendance(tx, lessonId, studentId, status);
    if (status === "present") return;
    const items = await tx.query("homework", "studentId", { equals: studentId });
    for (const item of items) {
      const postponed = postponedLessonsOf(item);
      if (item.deletedAt !== null || !postponed.includes(lessonId)) continue;
      await tx.update("homework", item.id, {
        postponedLessonIds: postponed.filter((id) => id !== lessonId),
      });
    }
  });
}

/** Undoes a postponement made in this lesson. */
export async function undoPostpone(
  store: DataWriter,
  item: Pick<HomeworkRecord, "id">,
  lessonId: string,
) {
  await store.transaction(async (tx) => {
    const current = await tx.get("homework", item.id);
    if (!current) return;
    const postponed = postponedLessonsOf(current);
    if (!postponed.includes(lessonId)) return;
    await tx.update("homework", item.id, {
      postponedLessonIds: postponed.filter((id) => id !== lessonId),
    });
  });
}

/**
 * Undoes an evaluation made in this lesson. An item created here to be
 * recited on the spot ("تسميع الآن") is removed; any other goes back to pending.
 */
export async function undoEvaluation(store: DataWriter, item: HomeworkRecord, lessonId: string) {
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
export function addHomework(
  store: DataWriter,
  input: {
    studentId: string;
    lessonId: string;
    portion: Portion;
    note: string;
    evaluateNow: boolean;
  },
) {
  return store.transaction(async (tx) => {
    if (input.evaluateNow) await ensurePresent(tx, input.lessonId, input.studentId);
    return tx.create("homework", {
      studentId: input.studentId,
      ...input.portion,
      note: input.note,
      assignedLessonId: input.lessonId,
      evaluatedLessonId: input.evaluateNow ? input.lessonId : null,
      memorizationRate: null,
      behaviorRate: null,
      postponedLessonIds: [],
      kind: "homework",
    });
  });
}

/**
 * Records an exam in this lesson: added and marked on the spot (one mark,
 * set afterwards), never assigned beforehand. Marks the student present.
 * Undo (undoEvaluation) removes it, since it was assigned in this lesson.
 */
export function addExam(
  store: DataWriter,
  input: { studentId: string; lessonId: string; portion: Portion; note: string },
) {
  return store.transaction(async (tx) => {
    await ensurePresent(tx, input.lessonId, input.studentId);
    return tx.create("homework", {
      studentId: input.studentId,
      ...input.portion,
      note: input.note,
      assignedLessonId: input.lessonId,
      evaluatedLessonId: input.lessonId,
      memorizationRate: null,
      behaviorRate: null,
      postponedLessonIds: [],
      kind: "exam",
    });
  });
}

/** Edits the portion (e.g. the student recited only part of it). */
export function updateHomework(store: DataWriter, id: string, portion: Portion, note: string) {
  return store.update("homework", id, { ...portion, note });
}

export function deleteHomework(store: DataWriter, id: string) {
  return store.softDelete("homework", id);
}
