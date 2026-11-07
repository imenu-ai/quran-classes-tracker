import type { Portion } from "../../domain/homework/suggestion";
import type { AttendanceStatus } from "../../shared/schemas/attendance";
import {
  memorizationChoices,
  NOT_MEMORIZED,
  notMemorizedIn,
  notMemorizedOf,
  type HomeworkRecord,
  type MemorizationChoice,
} from "../../shared/schemas/homework";
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
 * Sets (or clears, with null) one mark for this item in this lesson; the
 * memorization picker can also choose NOT_MEMORIZED ("لم يحفظ").
 *
 * - A mark makes the item evaluated in this lesson. If he was "not
 *   memorized" here, that's replaced, and its behavior mark carries over.
 * - NOT_MEMORIZED keeps (or puts) the item back to pending with an entry for
 *   this lesson, carrying over a behavior mark given here. Not for exams, items
 *   added in this lesson, or items recited in another lesson.
 * - While he's "not memorized" here, a behavior mark goes into that entry, and
 *   clearing the memorization picker removes the entry.
 * - A mark in a lesson where he failed it, after he recited it in a later
 *   one, is ignored (it would move that evaluation).
 *
 * Anything recorded marks the student present.
 */
export async function rateHomework(
  store: DataWriter,
  item: Pick<HomeworkRecord, "id" | "studentId">,
  lessonId: string,
  field: RateField,
  score: MemorizationChoice,
) {
  await store.transaction(async (tx) => {
    const current = await tx.get("homework", item.id);
    if (!current || current.deletedAt !== null) return;
    const entries = notMemorizedOf(current);
    const entry = notMemorizedIn(current, lessonId);
    const others = entries.filter((e) => e.lessonId !== lessonId);
    const choices = memorizationChoices(current, lessonId);
    const evaluatedHere = current.evaluatedLessonId === lessonId;

    if (score === NOT_MEMORIZED) {
      if (field !== "memorizationRate" || !choices.notMemorized || entry) return;
      await ensurePresent(tx, lessonId, current.studentId);
      await tx.update("homework", current.id, {
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
        notMemorized: [
          ...others,
          { lessonId, behaviorRate: evaluatedHere ? current.behaviorRate : null },
        ],
      });
      return;
    }

    if (entry && (field === "behaviorRate" || score === null)) {
      await ensurePresent(tx, lessonId, current.studentId);
      await tx.update("homework", current.id, {
        notMemorized:
          field === "behaviorRate" ? [...others, { lessonId, behaviorRate: score }] : others,
      });
      return;
    }

    if (!choices.marks) return;
    await ensurePresent(tx, lessonId, current.studentId);
    await tx.update("homework", current.id, {
      evaluatedLessonId: lessonId,
      [field]: score,
      ...(entry ? { notMemorized: others, behaviorRate: entry.behaviorRate } : {}),
    });
  });
}

/**
 * Sets a student's attendance in a lesson. "Not memorized" means he was
 * there, so marking him absent or excused also removes those entries (and
 * their behavior marks) in that lesson.
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
      if (item.deletedAt !== null || !notMemorizedIn(item, lessonId)) continue;
      await tx.update("homework", item.id, {
        notMemorized: notMemorizedOf(item).filter((e) => e.lessonId !== lessonId),
      });
    }
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
      notMemorized: [],
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
      notMemorized: [],
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
