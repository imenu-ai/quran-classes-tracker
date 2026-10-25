import type {
  IndexName,
  IndexQuery,
  LocalRecord,
  LocalTable,
  StorageAdapter,
  StorageReader,
  StorageWriter,
} from "./storage";

/** A transaction on the local database. Starting a transaction inside it joins it. */
export interface DatabaseTransaction extends StorageWriter {
  transaction<R>(fn: (tx: DatabaseTransaction) => Promise<R>): Promise<R>;
}

export type ChangeListener = (tables: ReadonlySet<LocalTable>) => void;

/**
 * The device's local database, over a platform adapter. Every write happens
 * in a transaction; once one commits, listeners hear which tables it changed
 * (screens on mobile re-run their queries from this). A transaction that
 * fails changes nothing and announces nothing.
 */
export class LocalDatabase implements StorageReader {
  private readonly listeners = new Set<ChangeListener>();

  constructor(private readonly adapter: StorageAdapter) {}

  get<T extends LocalTable>(table: T, key: string) {
    return this.adapter.get(table, key);
  }

  bulkGet<T extends LocalTable>(table: T, keys: readonly string[]) {
    return this.adapter.bulkGet(table, keys);
  }

  query<T extends LocalTable>(table: T, index: IndexName<T>, query: IndexQuery) {
    return this.adapter.query(table, index, query);
  }

  all<T extends LocalTable>(table: T): Promise<LocalRecord<T>[]> {
    return this.adapter.all(table);
  }

  count(table: LocalTable) {
    return this.adapter.count(table);
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async transaction<R>(fn: (tx: DatabaseTransaction) => Promise<R>): Promise<R> {
    const changed = new Set<LocalTable>();
    const result = await this.adapter.transaction((raw) => fn(tracked(raw, changed)));
    if (changed.size > 0) for (const listener of this.listeners) listener(changed);
    return result;
  }

  /** Deletes the whole local database (sign-out on this device). */
  destroy(): Promise<void> {
    return this.adapter.destroy();
  }
}

/** The adapter's transaction, recording which tables it writes. */
function tracked(raw: StorageWriter, changed: Set<LocalTable>): DatabaseTransaction {
  const tx: DatabaseTransaction = {
    get: (table, key) => raw.get(table, key),
    bulkGet: (table, keys) => raw.bulkGet(table, keys),
    query: (table, index, query) => raw.query(table, index, query),
    all: (table) => raw.all(table),
    count: (table) => raw.count(table),
    put: (table, record) => {
      changed.add(table);
      return raw.put(table, record);
    },
    bulkPut: (table, records) => {
      if (records.length > 0) changed.add(table);
      return raw.bulkPut(table, records);
    },
    delete: (table, key) => {
      changed.add(table);
      return raw.delete(table, key);
    },
    bulkDelete: (table, keys) => {
      if (keys.length > 0) changed.add(table);
      return raw.bulkDelete(table, keys);
    },
    transaction: (fn) => fn(tx),
  };
  return tx;
}
