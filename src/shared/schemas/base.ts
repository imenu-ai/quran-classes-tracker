import { z } from "zod";
import { isLocalDate } from "@/domain/dates/local-date";

/** Client-generated UUID (v7 for most records, v5 for lessons/attendance). */
export const idSchema = z.uuid();

export const epochMsSchema = z.number().int().nonnegative();

export const localDateSchema = z.string().refine(isLocalDate, { error: "INVALID_FORMAT" });

/** Free-text note; empty string when there is none. */
export const noteSchema = (max: number) => z.string().trim().max(max);

export const NAME_MAX = 100;
export const NOTE_MAX = 1000;

/** Fields shared by every syncable record. */
export const syncableBaseSchema = z.object({
  id: idSchema,
  tenantId: z.string().min(1),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  /**
   * Device that made the last change. Breaks last-write-wins ties when two
   * devices write the same record in the same millisecond.
   */
  updatedBy: z.string().min(1).max(64),
  deletedAt: epochMsSchema.nullable(),
  /** Assigned by the server; 0 until the record has been synced. */
  serverVersion: z.number().int().nonnegative(),
});

export type SyncableBase = z.infer<typeof syncableBaseSchema>;
