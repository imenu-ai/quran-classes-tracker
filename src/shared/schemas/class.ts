import { z } from "zod";
import { epochMsSchema, syncableBaseSchema } from "./base";

export const CLASS_NAME_MAX = 60;

export const classFieldsSchema = z.object({
  name: z.string().trim().min(1).max(CLASS_NAME_MAX),
});

export const classRecordSchema = syncableBaseSchema.extend({
  ...classFieldsSchema.shape,
  archivedAt: epochMsSchema.nullable(),
});

export type ClassRecord = z.infer<typeof classRecordSchema>;
