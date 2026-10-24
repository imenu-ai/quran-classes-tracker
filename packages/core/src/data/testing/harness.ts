import { LocalDatabase } from "../database";
import { LocalStore } from "../local-store";
import type { LocalRecord, LocalTable, StorageAdapter, StorageWriter } from "../storage";

/**
 * Creates a fresh, empty adapter for one test. The shared suites run on every
 * adapter: memory in core, Dexie in the web app, SQLite in the mobile app.
 */
export type StorageFactory = () => StorageAdapter | Promise<StorageAdapter>;

export interface TestDevice {
  adapter: StorageAdapter;
  db: LocalDatabase;
  store: LocalStore;
  /** The store's clock (starts at 1,000). */
  setNow(ms: number): void;
  destroy(): Promise<void>;
}

/** A fresh database and store, as one device would have them. */
export async function openTestDevice(
  factory: StorageFactory,
  options: {
    tenantId?: string;
    deviceId?: string;
    /** The store's clock; without it, a test clock starting at 1,000 (see setNow). */
    now?: () => number;
    wrap?: (a: StorageAdapter) => StorageAdapter;
  } = {},
): Promise<TestDevice> {
  const raw = await factory();
  const adapter = options.wrap ? options.wrap(raw) : raw;
  const db = new LocalDatabase(adapter);
  let now = 1_000;
  const store = new LocalStore(db, {
    tenantId: options.tenantId ?? "t1",
    deviceId: options.deviceId ?? "device-a",
    now: options.now ?? (() => now),
  });
  return {
    adapter,
    db,
    store,
    setNow: (ms) => (now = ms),
    destroy: () => raw.destroy(),
  };
}

/** Stores a record directly (test setup: as if it had been pulled). */
export function putRecord<T extends LocalTable>(
  db: LocalDatabase,
  table: T,
  record: LocalRecord<T>,
) {
  return db.transaction((tx) => tx.put(table, record));
}

/** Stores records directly (test setup: as if they had been pulled). */
export function putRecords<T extends LocalTable>(
  db: LocalDatabase,
  table: T,
  records: readonly LocalRecord<T>[],
) {
  return db.transaction((tx) => tx.bulkPut(table, records));
}

/**
 * Wraps an adapter so that writes to `table` fail while `failing()` is true,
 * to check that a failed write undoes the whole transaction.
 */
export function failingWrites(
  adapter: StorageAdapter,
  table: LocalTable,
  failing: () => boolean,
): StorageAdapter {
  const guard =
    <A extends unknown[]>(name: LocalTable, write: (...args: A) => Promise<void>) =>
    (...args: A) =>
      name === table && failing() ? Promise.reject(new Error("disk full")) : write(...args);
  return {
    get: (t, k) => adapter.get(t, k),
    bulkGet: (t, k) => adapter.bulkGet(t, k),
    query: (t, i, q) => adapter.query(t, i, q),
    all: (t) => adapter.all(t),
    count: (t) => adapter.count(t),
    destroy: () => adapter.destroy(),
    transaction: (fn) =>
      adapter.transaction((tx) => {
        const wrapped: StorageWriter = {
          get: (t, k) => tx.get(t, k),
          bulkGet: (t, k) => tx.bulkGet(t, k),
          query: (t, i, q) => tx.query(t, i, q),
          all: (t) => tx.all(t),
          count: (t) => tx.count(t),
          put: (t, r) => guard(t, tx.put.bind(tx))(t, r as never),
          bulkPut: (t, r) => guard(t, tx.bulkPut.bind(tx))(t, r as never),
          delete: (t, k) => guard(t, tx.delete.bind(tx))(t, k),
          bulkDelete: (t, k) => guard(t, tx.bulkDelete.bind(tx))(t, k),
        };
        return fn(wrapped);
      }),
  };
}
