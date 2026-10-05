import { v5 as uuidv5 } from "uuid";
import type { LocalDate } from "@/domain/dates/local-date";

/** Fixed namespace for this app's deterministic (UUIDv5) ids. Never change it. */
const ID_NAMESPACE = "6f1c2a8e-3d4b-5c6d-9e7f-0a1b2c3d4e5f";

/**
 * Lesson id derived from the class and the date it was created for, so two
 * devices that start "today's lesson" offline create the SAME record and
 * merge on sync instead of duplicating (see PLAN.md §2.2).
 */
export function lessonIdFor(classId: string, date: LocalDate): string {
  return uuidv5(`lesson:${classId}:${date}`, ID_NAMESPACE);
}

/** One attendance record per student per lesson, by construction. */
export function attendanceIdFor(lessonId: string, studentId: string): string {
  return uuidv5(`attendance:${lessonId}:${studentId}`, ID_NAMESPACE);
}
