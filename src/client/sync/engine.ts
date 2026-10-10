import type { PullResponse, PushResponse } from "@/shared/sync/protocol";
import { SYNC_TABLES } from "@/shared/sync/tables";
import type { LocalDb } from "../db/dexie";
import { acknowledge, markFailed, readOutboxBatch, reject } from "../db/outbox";
import { applyPulledChanges, CURSOR_KEY, getCursor } from "./apply-pull";
import { backoffDelay } from "./backoff";

export type SyncState = "idle" | "syncing" | "offline" | "needsLogin" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  /** Consecutive failed runs (drives the backoff). */
  failures: number;
}

export interface SyncEngineOptions {
  db: LocalDb;
  fetch?: typeof fetch;
  now?: () => number;
  random?: () => number;
  /** Whether the browser believes it's online. */
  isOnline?: () => boolean;
  pushBatchSize?: number;
  pullLimit?: number;
  /** Injectable timers for tests. */
  timers?: Timers;
  /** The access version the device last saw (from the saved session). */
  getAccessVersion?: () => number | undefined;
  /**
   * The server reported a new access version: the local copy was already
   * rebuilt for the new access; refresh the saved session (permissions,
   * classes) so the UI follows.
   */
  onAccessChanged?: () => Promise<void>;
  /** The server wants the password an admin set replaced first (403). */
  onPasswordChangeRequired?: () => void;
}

export interface Timers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const defaultTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The session is gone (401): keep everything local and wait for a new login. */
class NeedsLoginError extends Error {}
/** A network failure or a server error: try again later. */
class TransientError extends Error {}
/** The user must replace an admin-set password before syncing. */
class PasswordChangeRequiredError extends Error {}

const PUSH_URL = "/api/sync/push";
const PULL_URL = "/api/sync/pull";

/**
 * Moves changes between the local database and the server: push the outbox,
 * then pull everything newer than the cursor. One run at a time per engine
 * (and per browser, via the Web Locks API). Nothing local is ever dropped on
 * failure: the outbox only shrinks when the server acknowledges a change.
 */
export class SyncEngine {
  private status: SyncStatus = { state: "idle", lastSyncedAt: null, failures: 0 };
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private running: Promise<void> | null = null;
  private rerun = false;
  private retryTimer: unknown = null;
  private readonly timers: Timers;

  private readonly db: LocalDb;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly isOnline: () => boolean;
  private readonly pushBatchSize: number;
  private readonly pullLimit: number;
  private readonly options: SyncEngineOptions;
  /** The latest access version a sync response reported. */
  private reportedAccessVersion: number | undefined;

  constructor(options: SyncEngineOptions) {
    this.options = options;
    this.db = options.db;
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args));
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.isOnline = options.isOnline ?? (() => globalThis.navigator?.onLine !== false);
    this.pushBatchSize = options.pushBatchSize ?? 100;
    this.pullLimit = options.pullLimit ?? 500;
    this.timers = options.timers ?? defaultTimers;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Runs a sync now. If one is already running, another run follows it (so
   * changes made meanwhile are picked up) and the same promise is returned.
   */
  syncNow(): Promise<void> {
    if (this.status.state === "needsLogin") return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Call after a successful login to resume syncing what was kept locally. */
  resumeAfterLogin(): Promise<void> {
    if (this.status.state === "needsLogin") this.setStatus({ state: "idle", failures: 0 });
    return this.syncNow();
  }

  /** Marks the device offline (from the browser's `offline` event). */
  markOffline(): void {
    if (this.status.state !== "needsLogin") this.setStatus({ state: "offline" });
  }

  dispose(): void {
    if (this.retryTimer) this.timers.clear(this.retryTimer);
    this.retryTimer = null;
    this.listeners.clear();
  }

  private async loop(): Promise<void> {
    do {
      this.rerun = false;
      await this.runOnce();
    } while (this.rerun && this.status.state !== "needsLogin");
  }

  private async runOnce(): Promise<void> {
    if (!this.isOnline()) {
      this.setStatus({ state: "offline" });
      return;
    }
    if (this.retryTimer) {
      this.timers.clear(this.retryTimer);
      this.retryTimer = null;
    }
    this.setStatus({ state: "syncing" });
    try {
      await withLock(async () => {
        await this.pushAll();
        if (this.accessChanged()) await this.rebuildForNewAccess();
        await this.pullAll();
        // Access may also change between the push and the pull.
        if (this.accessChanged()) {
          await this.rebuildForNewAccess();
          await this.pullAll();
        }
        if (this.rebuilt) {
          this.rebuilt = false;
          await this.options.onAccessChanged?.();
        }
      });
      this.setStatus({ state: "idle", failures: 0, lastSyncedAt: this.now() });
    } catch (error) {
      if (error instanceof NeedsLoginError) {
        this.setStatus({ state: "needsLogin" });
        return;
      }
      if (error instanceof PasswordChangeRequiredError) {
        this.setStatus({ state: "idle" });
        this.options.onPasswordChangeRequired?.();
        return;
      }
      const failures = this.status.failures + 1;
      const offline = !this.isOnline() || error instanceof TypeError;
      this.setStatus({ state: offline ? "offline" : "error", failures });
      this.scheduleRetry(backoffDelay(failures, this.random));
    }
  }

  private scheduleRetry(delay: number) {
    if (this.retryTimer) this.timers.clear(this.retryTimer);
    this.retryTimer = this.timers.set(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delay);
  }

  private async pushAll(): Promise<void> {
    for (;;) {
      const items = await readOutboxBatch(this.db, this.pushBatchSize);
      if (items.length === 0) return;
      const sent = items.map((item) => item.entry);

      let response: Response;
      try {
        response = await this.fetchImpl(PUSH_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mutations: items.map(({ entry, record }) => ({ table: entry.table, record })),
          }),
        });
      } catch (error) {
        await markFailed(this.db, sent, "NETWORK");
        throw error;
      }
      if (response.status === 401) throw new NeedsLoginError();
      if (response.status === 403) throw new PasswordChangeRequiredError();
      if (!response.ok) {
        await markFailed(this.db, sent, `HTTP_${response.status}`);
        throw new TransientError(`push failed with ${response.status}`);
      }

      const { results, accessVersion } = (await response.json()) as PushResponse;
      this.reportedAccessVersion = accessVersion;
      const accepted = [];
      for (const [index, entry] of sent.entries()) {
        const result = results[index];
        if (!result || result.id !== entry.recordId) {
          throw new TransientError("push response does not match the request");
        }
        if (result.status === "rejected") {
          await reject(this.db, entry, result.code ?? "INVALID", result.params ?? {}, this.now());
        } else {
          accepted.push(entry);
        }
      }
      await acknowledge(this.db, accepted);
      // Loop: more entries, or records edited while this batch was in flight.
    }
  }

  private async pullAll(): Promise<void> {
    for (;;) {
      const since = await getCursor(this.db);
      const url = `${PULL_URL}?since=${since}&limit=${this.pullLimit}`;
      const response = await this.fetchImpl(url, { headers: { accept: "application/json" } });
      if (response.status === 401) throw new NeedsLoginError();
      if (response.status === 403) throw new PasswordChangeRequiredError();
      if (!response.ok) throw new TransientError(`pull failed with ${response.status}`);

      const page = (await response.json()) as PullResponse;
      this.reportedAccessVersion = page.accessVersion;
      // Don't apply a page cut for different access; the caller rebuilds first.
      if (this.accessChanged()) return;
      await applyPulledChanges(this.db, page);
      if (!page.hasMore) return;
    }
  }

  /** Set while the local copy was rebuilt and the session not refreshed yet. */
  private rebuilt = false;

  private accessChanged(): boolean {
    const known = this.options.getAccessVersion?.();
    const reported = this.reportedAccessVersion;
    return known !== undefined && reported !== undefined && reported !== known && !this.rebuilt;
  }

  /**
   * The user's classes or permissions changed: drop the local copy of
   * everything the server confirmed and pull it again from scratch, so
   * classes he lost disappear and classes he gained arrive in full. Records
   * with a pending or rejected change are kept: nothing unsynced is lost.
   */
  private async rebuildForNewAccess(): Promise<void> {
    const { db } = this;
    const tables = SYNC_TABLES.map((table) => db.syncTable(table));
    await db.transaction("rw", [...tables, db.outbox, db.rejected, db.meta], async () => {
      const keep = new Set<string>([
        ...((await db.outbox.toCollection().primaryKeys()) as string[]),
        ...((await db.rejected.toCollection().primaryKeys()) as string[]),
      ]);
      for (const table of tables) {
        const ids = (await table.toCollection().primaryKeys()) as string[];
        await table.bulkDelete(ids.filter((id) => !keep.has(id)));
      }
      await db.meta.put({ key: CURSOR_KEY, value: 0 });
    });
    this.rebuilt = true;
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener(this.status);
  }
}

/** Runs `task` under a cross-tab lock when the Web Locks API exists. */
async function withLock(task: () => Promise<void>): Promise<void> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return task();
  await locks.request("qct-sync", task);
}
