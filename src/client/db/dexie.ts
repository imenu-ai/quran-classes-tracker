import Dexie, { type EntityTable, type Table } from "dexie";
import type { ErrorParams } from "@/shared/schemas/errors";
import type { SyncRecordMap, SyncTable } from "@/shared/sync/tables";

/** A pending local change waiting to be pushed (one entry per record). */
export interface OutboxEntry {
  recordId: string;
  table: SyncTable;
  /** Bumped on every local write; the push only clears the revision it sent. */
  rev: number;
  /** When the record first entered the outbox; pushes go oldest first, so parents precede children. */
  enqueuedAt: number;
  attempts: number;
  lastError: string | null;
}

/** A change the server refused (e.g. invalid data). Only the user can discard it. */
export interface RejectedEntry {
  recordId: string;
  table: SyncTable;
  code: string;
  params: ErrorParams;
  rejectedAt: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * The device's local database. One database per signed-in user, so a shared
 * device never mixes two accounts' data. The UI reads and writes only here.
 */
export class LocalDb extends Dexie {
  classes!: EntityTable<SyncRecordMap["classes"], "id">;
  students!: EntityTable<SyncRecordMap["students"], "id">;
  lessons!: EntityTable<SyncRecordMap["lessons"], "id">;
  attendance!: EntityTable<SyncRecordMap["attendance"], "id">;
  homework!: EntityTable<SyncRecordMap["homework"], "id">;
  outbox!: EntityTable<OutboxEntry, "recordId">;
  rejected!: EntityTable<RejectedEntry, "recordId">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      classes: "id, updatedAt",
      students: "id, classId, fullName",
      lessons: "id, classId, [classId+date], date",
      attendance: "id, lessonId, studentId",
      homework: "id, studentId, assignedLessonId, evaluatedLessonId",
      outbox: "recordId, enqueuedAt",
      rejected: "recordId",
      meta: "key",
    });
  }

  /** The Dexie table for a syncable table name. */
  syncTable<T extends SyncTable>(table: T): Table<SyncRecordMap[T], string, SyncRecordMap[T]> {
    return this[table] as unknown as Table<SyncRecordMap[T], string, SyncRecordMap[T]>;
  }
}

export const localDbName = (userId: string) => `qct-${userId}`;

export function openLocalDb(userId: string): LocalDb {
  return new LocalDb(localDbName(userId));
}
