import { z } from "zod";
import { idSchema, localDateSchema, noteSchema, NOTE_MAX, syncableBaseSchema } from "./base";

export const lessonFieldsSchema = z.object({
  classId: idSchema,
  /** Local calendar date in the tenant's time zone. */
  date: localDateSchema,
  note: noteSchema(NOTE_MAX),
});

export const lessonRecordSchema = syncableBaseSchema.extend(lessonFieldsSchema.shape);

export type LessonRecord = z.infer<typeof lessonRecordSchema>;
