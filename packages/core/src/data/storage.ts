import type { ErrorParams } from "../shared/schemas/errors";
import type { SyncRecordMap, SyncTable } from "../shared/sync/tables";

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

/** Everything a device stores locally: the synced records plus sync bookkeeping. */
export interface LocalRecordMap extends SyncRecordMap {
  outbox: OutboxEntry;
  rejected: RejectedEntry;
  meta: MetaEntry;
}

export type LocalTable = keyof LocalRecordMap;
export type LocalRecord<T extends LocalTable> = LocalRecordMap[T];

/**
 * Every local table: its primary key and the indexes queries may use. A
 * compound index is written "[a+b]" and queried with a tuple. Adapters must
 * provide exactly these (the web's Dexie schema is tested against this list).
 */
export const TABLE_SCHEMA = {
  classes: { key: "id", indexes: ["updatedAt"] },
  students: { key: "id", indexes: ["classId", "fullName"] },
  lessons: { key: "id", indexes: ["classId", "[classId+date]", "date"] },
  attendance: { key: "id", indexes: ["lessonId", "studentId"] },
  homework: { key: "id", indexes: ["studentId", "assignedLessonId", "evaluatedLessonId"] },
  outbox: { key: "recordId", indexes: ["enqueuedAt"] },
  rejected: { key: "recordId", indexes: [] },
  meta: { key: "key", indexes: [] },
} as const satisfies Record<LocalTable, { key: string; indexes: readonly string[] }>;

export const LOCAL_TABLES = Object.keys(TABLE_SCHEMA) as LocalTable[];

export type IndexName<T extends LocalTable> = (typeof TABLE_SCHEMA)[T]["indexes"][number];

/** A value of an index: a string or number, or a tuple for a compound index. */
export type IndexKey = string | number | readonly (string | number)[];

/** Which records of an index a query returns. `between` includes both ends. */
export type IndexQuery =
  | { equals: IndexKey }
  | { anyOf: readonly IndexKey[] }
  | { between: readonly [IndexKey, IndexKey] };

/**
 * Reads. `query` returns records ordered by the index value, then the primary
 * key; `all` returns them by primary key. Records without a value for the
 * index (null or missing) are never part of a query's results.
 */
export interface StorageReader {
  get<T extends LocalTable>(table: T, key: string): Promise<LocalRecord<T> | undefined>;
  bulkGet<T extends LocalTable>(
    table: T,
    keys: readonly string[],
  ): Promise<(LocalRecord<T> | undefined)[]>;
  query<T extends LocalTable>(
    table: T,
    index: IndexName<T>,
    query: IndexQuery,
  ): Promise<LocalRecord<T>[]>;
  all<T extends LocalTable>(table: T): Promise<LocalRecord<T>[]>;
  count(table: LocalTable): Promise<number>;
}

/** Reads plus raw writes, only available inside a transaction. */
export interface StorageWriter extends StorageReader {
  put<T extends LocalTable>(table: T, record: LocalRecord<T>): Promise<void>;
  bulkPut<T extends LocalTable>(table: T, records: readonly LocalRecord<T>[]): Promise<void>;
  delete(table: LocalTable, key: string): Promise<void>;
  bulkDelete(table: LocalTable, keys: readonly string[]): Promise<void>;
}

/**
 * What each platform implements (Dexie on the web, SQLite on mobile). App
 * code never uses an adapter directly: it goes through LocalDatabase.
 *
 * `transaction` runs `fn` with every write made through `tx`, all or
 * nothing: if `fn` throws, nothing it wrote is kept. Transactions run one at
 * a time; reads outside a transaction see only committed data.
 */
export interface StorageAdapter extends StorageReader {
  transaction<R>(fn: (tx: StorageWriter) => Promise<R>): Promise<R>;
  /** Deletes the whole local database (sign-out on this device). */
  destroy(): Promise<void>;
}
