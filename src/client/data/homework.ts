import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import {
  evaluationProgress,
  splitLessonHomework,
  type StudentLessonHomework,
} from "@/domain/homework/progress";
import type { Portion } from "@/domain/homework/suggestion";
import type { HomeworkRecord } from "@/shared/schemas/homework";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { useApp } from "../app-context";
import type { LocalDb } from "../db/dexie";
import type { LocalStore } from "../db/local-store";
import { buildRoster, findAttendance, setAttendance, type LessonRosterEntry } from "./attendance";

export interface EvaluationEntry extends LessonRosterEntry {
  homework: StudentLessonHomework<HomeworkRecord>;
  /** Every non-deleted homework item of the student (for the next suggestion). */
  history: HomeworkRecord[];
}

export interface LessonEvaluation {
  present: EvaluationEntry[];
  /** Not marked yet: evaluating one of them marks them present. */
  unmarked: EvaluationEntry[];
  progress: { done: number; total: number };
}

/** Everything the evaluation step shows, live from the local database. */
export function useLessonEvaluation(lesson: LessonRecord) {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(async (): Promise<LessonEvaluation> => {
    const [classStudents, records] = await Promise.all([
      db.students.where("classId").equals(lesson.classId).toArray(),
      db.attendance.where("lessonId").equals(lesson.id).toArray(),
    ]);
    const recorded = await db.students.bulkGet(records.map((r) => r.studentId));
    const roster = buildRoster(
      classStudents,
      [...classStudents, ...recorded.filter((s) => s !== undefined)],
      records,
      locale,
    );

    const studentIds = roster.map((entry) => entry.student.id);
    const homework = await db.homework.where("studentId").anyOf(studentIds).toArray();
    const lessonIds = [
      ...new Set(homework.flatMap((h) => [h.assignedLessonId, h.evaluatedLessonId])),
    ].filter((id): id is string => id !== null);
    const lessons = await db.lessons.bulkGet(lessonIds);
    const lessonDates = new Map(
      lessons.filter((l) => l !== undefined).map((l) => [l.id, l.date] as const),
    );

    const entries: EvaluationEntry[] = roster.map((entry) => {
      const own = homework.filter((h) => h.studentId === entry.student.id && h.deletedAt === null);
      return {
        ...entry,
        history: own,
        homework: splitLessonHomework(own, lesson, lessonDates),
      };
    });
    const present = entries.filter((entry) => entry.attendance?.status === "present");
    return {
      present,
      unmarked: entries.filter((entry) => !entry.attendance),
      progress: evaluationProgress(
        present.map((entry) => entry.student.id),
        homework,
        lesson.id,
      ),
    };
  }, [db, lesson.id, lesson.classId, lesson.date, locale]);
}

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

/** Sets (or clears, with null) one score; the item becomes evaluated in this lesson. */
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
    await store.update("homework", item.id, { evaluatedLessonId: lessonId, [field]: score });
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
