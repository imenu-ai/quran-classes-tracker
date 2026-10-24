import Dexie, { type EntityTable, type IndexableType, type Table } from "dexie";
import { LocalDatabase } from "@qct/core/data/database";
import type {
  LocalTable,
  MetaEntry,
  OutboxEntry,
  RejectedEntry,
  StorageAdapter,
  StorageReader,
  StorageWriter,
} from "@qct/core/data/storage";
import type { SyncRecordMap } from "@qct/core/shared/sync/tables";

/**
 * The device's IndexedDB database. One database per signed-in user, so a
 * shared device never mixes two accounts' data. Its tables and indexes are
 * core's TABLE_SCHEMA (checked by a test); app code reaches it only through
 * LocalDatabase.
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
    // Never edit a released version: add version(n + 1) with the change.
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
}

export const localDbName = (userId: string) => `qct-${userId}`;

/** Reads on Dexie tables: the database's, or one transaction's. */
function dexieReader(table: (name: LocalTable) => Table): StorageReader {
  return {
    get: (name, key) => table(name).get(key),
    bulkGet: (name, keys) => table(name).bulkGet([...keys]),
    query: (name, index, query) => {
      const where = table(name).where(index);
      const found =
        "equals" in query
          ? where.equals(query.equals as IndexableType)
          : "anyOf" in query
            ? where.anyOf([...query.anyOf] as IndexableType[])
            : where.between(
                query.between[0] as IndexableType,
                query.between[1] as IndexableType,
                true,
                true,
              );
      return found.toArray();
    },
    all: (name) => table(name).toArray(),
    count: (name) => table(name).count(),
  };
}

/** The storage contract (core's storage.ts) on Dexie. */
export function createDexieStorage(db: LocalDb): StorageAdapter {
  return {
    ...dexieReader((name) => db.table(name)),
    // One read-write transaction over every table, so actions don't list
    // theirs. Every operation goes through `trans.table()`, bound to this
    // transaction: Dexie's implicit zone doesn't survive deeply nested native
    // async calls, and a call outside it would start a second transaction that
    // waits for this one while this one commits too early.
    transaction: (fn) =>
      db.transaction("rw", db.tables, (trans) => {
        const table = (name: LocalTable) => trans.table(name);
        const writer: StorageWriter = {
          ...dexieReader(table),
          put: (name, record) =>
            table(name)
              .put(record)
              .then(() => undefined),
          bulkPut: (name, records) =>
            table(name)
              .bulkPut([...records])
              .then(() => undefined),
          delete: (name, key) => table(name).delete(key),
          bulkDelete: (name, keys) => table(name).bulkDelete([...keys]),
        };
        return fn(writer);
      }),
    // Delete through the open instance so its own connection doesn't block it.
    destroy: () => db.delete(),
  };
}

/** The signed-in user's local database. */
export function openLocalDatabase(userId: string): LocalDatabase {
  return new LocalDatabase(createDexieStorage(new LocalDb(localDbName(userId))));
}
