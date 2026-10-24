import { v7 as uuidv7 } from "uuid";
import { parseWithCodes, type FieldError } from "../shared/schemas/errors";
import type { SyncableBase } from "../shared/schemas/base";
import { RECORD_SCHEMAS, type SyncRecordMap, type SyncTable } from "../shared/sync/tables";
import type { DatabaseTransaction, LocalDatabase } from "./database";
import type {
  IndexName,
  IndexQuery,
  LocalRecordMap,
  LocalTable,
  OutboxEntry,
  StorageReader,
} from "./storage";

/** Fields the store manages itself; callers never set them directly. */
type ManagedField = keyof SyncableBase;

/** The editable fields of a record in `T`. */
export type RecordFields<T extends SyncTable> = Omit<SyncRecordMap[T], ManagedField>;

export class LocalValidationError extends Error {
  constructor(readonly errors: FieldError[]) {
    super(`Invalid record: ${errors.map((error) => `${error.path}:${error.code}`).join(", ")}`);
  }
}

export class LocalRecordNotFoundError extends Error {
  constructor(table: SyncTable, id: string) {
    super(`No ${table} record with id ${id}`);
  }
}

/**
 * Reads plus record writes: the store itself (each write is its own
 * transaction) or a transaction handle from `transaction()`. Actions take a
 * DataWriter, so they work on their own or inside a larger transaction.
 */
export interface DataWriter extends StorageReader {
  create<T extends SyncTable>(
    table: T,
    fields: RecordFields<T>,
    options?: { id?: string },
  ): Promise<SyncRecordMap[T]>;
  update<T extends SyncTable>(
    table: T,
    id: string,
    patch: Partial<RecordFields<T>>,
  ): Promise<SyncRecordMap[T]>;
  upsert<T extends SyncTable>(
    table: T,
    id: string,
    fields: RecordFields<T>,
  ): Promise<SyncRecordMap[T]>;
  softDelete<T extends SyncTable>(table: T, id: string): Promise<SyncRecordMap[T]>;
  restore<T extends SyncTable>(table: T, id: string): Promise<SyncRecordMap[T]>;
  /** Runs `fn` all or nothing. Inside a transaction, it joins that transaction. */
  transaction<R>(fn: (tx: DataWriter) => Promise<R>): Promise<R>;
}

export interface LocalStoreOptions {
  tenantId: string;
  deviceId: string;
  /** Injectable clock for tests. */
  now?: () => number;
}

const CLOCK_KEY = "clock";

/** How long after a write the store still counts as busy (see isBusy). */
const BUSY_WINDOW_MS = 150;

/**
 * The only way the UI changes data. Each write validates the full record with
 * the shared Zod schema, then saves the record and its outbox entry in ONE
 * transaction: both are stored or neither is.
 */
export class LocalStore implements DataWriter {
  private readonly listeners = new Set<(tables: ReadonlySet<LocalTable>) => void>();
  /** Transactions started and not finished yet. */
  private pendingWrites = 0;
  /** When a transaction last started or finished (epoch ms). */
  private lastWriteActivity = 0;
  private readonly now: () => number;

  constructor(
    readonly db: LocalDatabase,
    private readonly options: LocalStoreOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /**
   * Called after every committed local write with the tables it changed (the
   * sync engine debounces on it). Records arriving from a pull don't count.
   */
  subscribe(listener: (tables: ReadonlySet<LocalTable>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get: DataWriter["get"] = (table, key) => this.db.get(table, key);
  bulkGet: DataWriter["bulkGet"] = (table, keys) => this.db.bulkGet(table, keys);
  query<T extends LocalTable>(table: T, index: IndexName<T>, query: IndexQuery) {
    return this.db.query(table, index, query);
  }
  all: DataWriter["all"] = (table) => this.db.all(table);
  count: DataWriter["count"] = (table) => this.db.count(table);

  create: DataWriter["create"] = (table, fields, options) =>
    this.transaction((tx) => tx.create(table, fields, options));
  update: DataWriter["update"] = (table, id, patch) =>
    this.transaction((tx) => tx.update(table, id, patch));
  upsert: DataWriter["upsert"] = (table, id, fields) =>
    this.transaction((tx) => tx.upsert(table, id, fields));
  softDelete: DataWriter["softDelete"] = (table, id) =>
    this.transaction((tx) => tx.softDelete(table, id));
  restore: DataWriter["restore"] = (table, id) => this.transaction((tx) => tx.restore(table, id));

  async transaction<R>(fn: (tx: DataWriter) => Promise<R>): Promise<R> {
    this.pendingWrites += 1;
    this.lastWriteActivity = Date.now();
    const changed = new Set<LocalTable>();
    try {
      const result = await this.db.transaction((tx) =>
        fn(new StoreTransaction(tx, this.options, this.now, changed)),
      );
      if (changed.size > 0) for (const listener of this.listeners) listener(changed);
      return result;
    } finally {
      this.pendingWrites -= 1;
      this.lastWriteActivity = Date.now();
    }
  }

  /**
   * Whether a write is running or just finished. An action can chain several
   * writes (today's lesson, then the mark), with a short gap between them.
   */
  isBusy(): boolean {
    return this.pendingWrites > 0 || Date.now() - this.lastWriteActivity < BUSY_WINDOW_MS;
  }

  /**
   * Resolves once no write has run for a moment and everything written is
   * committed, or after `maxWaitMs` at the latest. On the web, a full page
   * load aborts IndexedDB transactions still in flight, so call this first.
   */
  async whenIdle(maxWaitMs = 2000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    while (this.isBusy() && Date.now() < deadline) await sleep(20);
    // A read of the outbox (which every write touches) waits for pending
    // write transactions on it to commit.
    await this.db.count("outbox");
  }
}

/** One store transaction: record writes with validation, outbox and clock. */
class StoreTransaction implements DataWriter {
  constructor(
    private readonly tx: DatabaseTransaction,
    private readonly options: LocalStoreOptions,
    private readonly now: () => number,
    private readonly changed: Set<LocalTable>,
  ) {}

  get: DataWriter["get"] = (table, key) => this.tx.get(table, key);
  bulkGet: DataWriter["bulkGet"] = (table, keys) => this.tx.bulkGet(table, keys);
  query<T extends LocalTable>(table: T, index: IndexName<T>, query: IndexQuery) {
    return this.tx.query(table, index, query);
  }
  all: DataWriter["all"] = (table) => this.tx.all(table);
  count: DataWriter["count"] = (table) => this.tx.count(table);

  transaction<R>(fn: (tx: DataWriter) => Promise<R>): Promise<R> {
    return fn(this);
  }

  async create<T extends SyncTable>(
    table: T,
    fields: RecordFields<T>,
    options: { id?: string } = {},
  ): Promise<SyncRecordMap[T]> {
    return this.write(table, async (timestamp) => {
      const id = options.id ?? uuidv7();
      if (await this.tx.get(table, id)) {
        throw new Error(`A ${table} record with id ${id} already exists`);
      }
      return {
        ...fields,
        id,
        tenantId: this.options.tenantId,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: this.options.deviceId,
        deletedAt: null,
        serverVersion: 0,
      } as SyncRecordMap[T];
    });
  }

  async update<T extends SyncTable>(
    table: T,
    id: string,
    patch: Partial<RecordFields<T>>,
  ): Promise<SyncRecordMap[T]> {
    return this.write(table, async (timestamp) => {
      const current = await this.tx.get(table, id);
      if (!current) throw new LocalRecordNotFoundError(table, id);
      return {
        ...current,
        ...patch,
        updatedAt: timestamp,
        updatedBy: this.options.deviceId,
      } as SyncRecordMap[T];
    });
  }

  /**
   * Creates the record with this id, or updates it if it exists. A soft-
   * deleted record is revived. Used for records with deterministic ids
   * (attendance, lessons), which may already exist from an earlier tap or
   * from another device.
   */
  async upsert<T extends SyncTable>(
    table: T,
    id: string,
    fields: RecordFields<T>,
  ): Promise<SyncRecordMap[T]> {
    return this.write(table, async (timestamp) => {
      const current = await this.tx.get(table, id);
      if (!current) {
        return {
          ...fields,
          id,
          tenantId: this.options.tenantId,
          createdAt: timestamp,
          updatedAt: timestamp,
          updatedBy: this.options.deviceId,
          deletedAt: null,
          serverVersion: 0,
        } as SyncRecordMap[T];
      }
      return {
        ...current,
        ...fields,
        deletedAt: null,
        updatedAt: timestamp,
        updatedBy: this.options.deviceId,
      } as SyncRecordMap[T];
    });
  }

  /** Soft delete: the record stays (with deletedAt) so history and sync keep working. */
  softDelete<T extends SyncTable>(table: T, id: string): Promise<SyncRecordMap[T]> {
    return this.setDeleted(table, id, true);
  }

  /** Reverses a soft delete. */
  restore<T extends SyncTable>(table: T, id: string): Promise<SyncRecordMap[T]> {
    return this.setDeleted(table, id, false);
  }

  private setDeleted<T extends SyncTable>(table: T, id: string, deleted: boolean) {
    return this.write(table, async (timestamp) => {
      const current = await this.tx.get(table, id);
      if (!current) throw new LocalRecordNotFoundError(table, id);
      return {
        ...current,
        deletedAt: deleted ? timestamp : null,
        updatedAt: timestamp,
        updatedBy: this.options.deviceId,
      } as SyncRecordMap[T];
    });
  }

  private async write<T extends SyncTable>(
    table: T,
    build: (timestamp: number) => Promise<SyncRecordMap[T]>,
  ): Promise<SyncRecordMap[T]> {
    const timestamp = await this.nextTimestamp();
    const candidate = await build(timestamp);
    const parsed = parseWithCodes(RECORD_SCHEMAS[table], candidate);
    if (!parsed.success) throw new LocalValidationError(parsed.errors);

    const record = parsed.data as SyncRecordMap[T];
    // A synced table's local record is its synced record.
    await this.tx.put(table, record as LocalRecordMap[T]);
    await this.enqueue(table, record.id, timestamp);
    for (const name of [table, "outbox", "rejected", "meta"] as const) this.changed.add(name);
    return record;
  }

  /**
   * A strictly increasing timestamp for this device, even if the clock stands
   * still or goes backwards, so a later edit always wins over an earlier one.
   */
  private async nextTimestamp(): Promise<number> {
    const last = (await this.tx.get("meta", CLOCK_KEY))?.value;
    const timestamp = Math.max(this.now(), typeof last === "number" ? last + 1 : 0);
    await this.tx.put("meta", { key: CLOCK_KEY, value: timestamp });
    return timestamp;
  }

  /** Adds the record to the outbox, or bumps its revision if it's already there. */
  private async enqueue(table: SyncTable, recordId: string, timestamp: number) {
    const existing = await this.tx.get("outbox", recordId);
    const entry: OutboxEntry = existing
      ? { ...existing, rev: existing.rev + 1 }
      : { recordId, table, rev: 1, enqueuedAt: timestamp, attempts: 0, lastError: null };
    await this.tx.put("outbox", entry);
    // A new edit supersedes an earlier server rejection of this record.
    await this.tx.delete("rejected", recordId);
  }
}
