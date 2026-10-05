import { z } from "zod";
import { idSchema, noteSchema, syncableBaseSchema } from "./base";

export const ATTENDANCE_STATUSES = ["present", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const EXCUSE_NOTE_MAX = 500;

export const attendanceFieldsSchema = z.object({
  lessonId: idSchema,
  studentId: idSchema,
  status: z.enum(ATTENDANCE_STATUSES),
  /** Only meaningful when status is "excused". */
  excuseNote: noteSchema(EXCUSE_NOTE_MAX),
});

export const attendanceRecordSchema = syncableBaseSchema.extend(attendanceFieldsSchema.shape);

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
