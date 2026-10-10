import { z } from "zod";
import type { ErrorParams } from "../schemas/errors";
import { SYNC_TABLES, type SyncRecordMap, type SyncTable } from "./tables";

/** Most mutations accepted in one push request. */
export const MAX_PUSH_BATCH = 200;

export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PULL_LIMIT = 1000;

/** Request body of POST /api/sync/push. Records are validated per table on the server. */
export const pushRequestSchema = z.object({
  mutations: z
    .array(
      z.object({
        table: z.enum(SYNC_TABLES),
        record: z.record(z.string(), z.unknown()),
      }),
    )
    .max(MAX_PUSH_BATCH),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;
export type PushMutation = PushRequest["mutations"][number];

/** Server-side reasons a record is refused (validation codes are passed through too). */
export const SYNC_REJECTION_CODES = ["FORBIDDEN", "REFERENCE_NOT_FOUND"] as const;

export type PushStatus = "applied" | "stale" | "rejected";

export interface PushResult {
  id: string;
  table: SyncTable;
  /**
   * applied: written. stale: the server already has this or a newer version
   * (the next pull brings the winner). rejected: refused, see `code`.
   */
  status: PushStatus;
  code?: string;
  params?: ErrorParams;
  serverVersion?: number;
}

export interface PushResponse {
  results: PushResult[];
  /** The user's access version: a new value means "resync from scratch". */
  accessVersion: number;
}

export const pullQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PULL_LIMIT).default(DEFAULT_PULL_LIMIT),
});

export type PullChanges = { [T in SyncTable]: SyncRecordMap[T][] };

export interface PullResponse {
  changes: PullChanges;
  /** Pass as `since` next time. */
  cursor: number;
  /** More changes are ready right now: pull again immediately. */
  hasMore: boolean;
  /** The user's access version (sync routes only): a new value means "resync from scratch". */
  accessVersion?: number;
}
