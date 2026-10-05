import type { ErrorParams } from "@/shared/schemas/errors";
import type { SyncRecord } from "@/shared/sync/tables";
import type { LocalDb, OutboxEntry } from "./dexie";

export interface OutboxItem {
  entry: OutboxEntry;
  record: SyncRecord;
}

/** Oldest entries first (parents before children), with the record's latest snapshot. */
export async function readOutboxBatch(db: LocalDb, limit: number): Promise<OutboxItem[]> {
  const entries = await db.outbox.orderBy("enqueuedAt").limit(limit).toArray();
  const items: OutboxItem[] = [];
  for (const entry of entries) {
    const record = await db.syncTable(entry.table).get(entry.recordId);
    if (record) items.push({ entry, record });
    // A record can't vanish locally (deletes are soft), so a missing one is
    // simply skipped; its entry stays for inspection rather than being dropped.
  }
  return items;
}

/**
 * Clears entries the server accepted (applied or already newer there), but
 * only if the record wasn't edited again while the push was in flight.
 */
export async function acknowledge(db: LocalDb, sent: readonly OutboxEntry[]): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const { recordId, rev } of sent) {
      const current = await db.outbox.get(recordId);
      if (current && current.rev === rev) await db.outbox.delete(recordId);
    }
  });
}

/**
 * Moves a refused change to the `rejected` store. If the record was edited
 * after it was sent, the newer revision stays queued and is tried instead.
 */
export async function reject(
  db: LocalDb,
  sent: OutboxEntry,
  code: string,
  params: ErrorParams,
  now: number,
): Promise<void> {
  await db.transaction("rw", [db.outbox, db.rejected], async () => {
    const current = await db.outbox.get(sent.recordId);
    if (!current || current.rev !== sent.rev) return;
    await db.outbox.delete(sent.recordId);
    await db.rejected.put({
      recordId: sent.recordId,
      table: sent.table,
      code,
      params,
      rejectedAt: now,
    });
  });
}

/** Records a failed attempt (network or server error). The entry is kept. */
export async function markFailed(
  db: LocalDb,
  sent: readonly OutboxEntry[],
  error: string,
): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const { recordId } of sent) {
      const current = await db.outbox.get(recordId);
      if (current) {
        await db.outbox.put({ ...current, attempts: current.attempts + 1, lastError: error });
      }
    }
  });
}

/** Puts a rejected change back in the outbox to try again. */
export async function retryRejected(db: LocalDb, recordId: string, now: number): Promise<void> {
  await db.transaction("rw", [db.outbox, db.rejected], async () => {
    const rejected = await db.rejected.get(recordId);
    if (!rejected) return;
    await db.rejected.delete(recordId);
    const existing = await db.outbox.get(recordId);
    if (!existing) {
      await db.outbox.put({
        recordId,
        table: rejected.table,
        rev: 1,
        enqueuedAt: now,
        attempts: 0,
        lastError: null,
      });
    }
  });
}

export function pendingCount(db: LocalDb): Promise<number> {
  return db.outbox.count();
}
