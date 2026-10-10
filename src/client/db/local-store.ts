import { v7 as uuidv7 } from "uuid";
import { parseWithCodes, type FieldError } from "@/shared/schemas/errors";
import type { SyncableBase } from "@/shared/schemas/base";
import { RECORD_SCHEMAS, type SyncRecordMap, type SyncTable } from "@/shared/sync/tables";
import type { LocalDb, OutboxEntry } from "./dexie";

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
 * IndexedDB transaction: both are stored or neither is.
 */
export class LocalStore {
  private readonly listeners = new Set<() => void>();
  /** Writes started and not finished yet. */
  private pendingWrites = 0;
  /** When a write last started or finished (epoch ms). */
  private lastWriteActivity = 0;
  private readonly now: () => number;

  constructor(
    readonly db: LocalDb,
    private readonly options: LocalStoreOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /** Called after every committed local write (the sync engine debounces on it). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async create<T extends SyncTable>(
    table: T,
    fields: RecordFields<T>,
    options: { id?: string } = {},
  ): Promise<SyncRecordMap[T]> {
    return this.write(table, async (timestamp) => {
      const id = options.id ?? uuidv7();
      if (await this.db.syncTable(table).get(id)) {
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
      const current = await this.db.syncTable(table).get(id);
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
      const current = await this.db.syncTable(table).get(id);
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
  async softDelete<T extends SyncTable>(table: T, id: string): Promise<SyncRecordMap[T]> {
    return this.setDeleted(table, id, true);
  }

  /** Reverses a soft delete. */
  async restore<T extends SyncTable>(table: T, id: string): Promise<SyncRecordMap[T]> {
    return this.setDeleted(table, id, false);
  }

  private setDeleted<T extends SyncTable>(table: T, id: string, deleted: boolean) {
    return this.write(table, async (timestamp) => {
      const current = await this.db.syncTable(table).get(id);
      if (!current) throw new LocalRecordNotFoundError(table, id);
      return {
        ...current,
        deletedAt: deleted ? timestamp : null,
        updatedAt: timestamp,
        updatedBy: this.options.deviceId,
      } as SyncRecordMap[T];
    });
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
   * committed, or after `maxWaitMs` at the latest. A full page load aborts
   * IndexedDB transactions still in flight, so call this before one.
   */
  async whenIdle(maxWaitMs = 2000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    while (this.isBusy() && Date.now() < deadline) await sleep(20);
    // A read on the outbox (in every write's scope) waits for every
    // read-write transaction on it to commit.
    await this.db.transaction("r", this.db.outbox, () => this.db.outbox.count());
  }

  private async write<T extends SyncTable>(
    table: T,
    build: (timestamp: number) => Promise<SyncRecordMap[T]>,
  ): Promise<SyncRecordMap[T]> {
    this.pendingWrites += 1;
    this.lastWriteActivity = Date.now();
    try {
      return await this.writeNow(table, build);
    } finally {
      this.pendingWrites -= 1;
      this.lastWriteActivity = Date.now();
    }
  }

  private async writeNow<T extends SyncTable>(
    table: T,
    build: (timestamp: number) => Promise<SyncRecordMap[T]>,
  ): Promise<SyncRecordMap[T]> {
    const { db } = this;
    const saved = await db.transaction(
      "rw",
      [db.syncTable(table), db.outbox, db.rejected, db.meta],
      async () => {
        const timestamp = await this.nextTimestamp();
        const candidate = await build(timestamp);
        const parsed = parseWithCodes(RECORD_SCHEMAS[table], candidate);
        if (!parsed.success) throw new LocalValidationError(parsed.errors);

        const record = parsed.data as SyncRecordMap[T];
        await db.syncTable(table).put(record);
        await enqueue(db, table, record.id, timestamp);
        return record;
      },
    );
    for (const listener of this.listeners) listener();
    return saved;
  }

  /**
   * A strictly increasing timestamp for this device, even if the clock stands
   * still or goes backwards, so a later edit always wins over an earlier one.
   */
  private async nextTimestamp(): Promise<number> {
    const last = (await this.db.meta.get(CLOCK_KEY))?.value;
    const timestamp = Math.max(this.now(), typeof last === "number" ? last + 1 : 0);
    await this.db.meta.put({ key: CLOCK_KEY, value: timestamp });
    return timestamp;
  }
}

/** Adds the record to the outbox, or bumps its revision if it's already there. */
async function enqueue(db: LocalDb, table: SyncTable, recordId: string, timestamp: number) {
  const existing = await db.outbox.get(recordId);
  const entry: OutboxEntry = existing
    ? { ...existing, rev: existing.rev + 1 }
    : { recordId, table, rev: 1, enqueuedAt: timestamp, attempts: 0, lastError: null };
  await db.outbox.put(entry);
  // A new edit supersedes an earlier server rejection of this record.
  await db.rejected.delete(recordId);
}
