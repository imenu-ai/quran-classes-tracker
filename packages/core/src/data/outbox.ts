import type { ErrorParams } from "../shared/schemas/errors";
import { SYNC_TABLES, type SyncRecord } from "../shared/sync/tables";
import type { LocalDatabase } from "./database";
import type { OutboxEntry, StorageReader } from "./storage";

export interface OutboxItem {
  entry: OutboxEntry;
  record: SyncRecord;
}

/**
 * The next entries to push, parents before children: by table (classes,
 * students, lessons, attendance, homework), then oldest first, each with
 * the record's latest snapshot.
 *
 * Ordering only by when an entry was first queued isn't enough: an unsynced
 * record edited later can point at a parent queued after it (homework from
 * yesterday scored in today's lesson, created just now), and the server
 * would refuse it as REFERENCE_NOT_FOUND.
 */
export async function readOutboxBatch(db: StorageReader, limit: number): Promise<OutboxItem[]> {
  const rank = (entry: OutboxEntry) => SYNC_TABLES.indexOf(entry.table);
  const entries = (await db.all("outbox"))
    .sort((a, b) => rank(a) - rank(b) || a.enqueuedAt - b.enqueuedAt)
    .slice(0, limit);
  const items: OutboxItem[] = [];
  for (const entry of entries) {
    const record = await db.get(entry.table, entry.recordId);
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
export async function acknowledge(db: LocalDatabase, sent: readonly OutboxEntry[]): Promise<void> {
  if (sent.length === 0) return;
  await db.transaction(async (tx) => {
    const current = await tx.bulkGet(
      "outbox",
      sent.map((entry) => entry.recordId),
    );
    const done = sent.filter((entry, i) => current[i]?.rev === entry.rev);
    await tx.bulkDelete(
      "outbox",
      done.map((entry) => entry.recordId),
    );
  });
}

/**
 * Moves a refused change to the `rejected` store. If the record was edited
 * after it was sent, the newer revision stays queued and is tried instead.
 */
export async function reject(
  db: LocalDatabase,
  sent: OutboxEntry,
  code: string,
  params: ErrorParams,
  now: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx.get("outbox", sent.recordId);
    if (!current || current.rev !== sent.rev) return;
    await tx.delete("outbox", sent.recordId);
    await tx.put("rejected", {
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
  db: LocalDatabase,
  sent: readonly OutboxEntry[],
  error: string,
): Promise<void> {
  if (sent.length === 0) return;
  await db.transaction(async (tx) => {
    const current = await tx.bulkGet(
      "outbox",
      sent.map((entry) => entry.recordId),
    );
    await tx.bulkPut(
      "outbox",
      current
        .filter((entry): entry is OutboxEntry => entry !== undefined)
        .map((entry) => ({ ...entry, attempts: entry.attempts + 1, lastError: error })),
    );
  });
}

/** Puts a rejected change back in the outbox to try again. */
export async function retryRejected(
  db: LocalDatabase,
  recordId: string,
  now: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rejected = await tx.get("rejected", recordId);
    if (!rejected) return;
    await tx.delete("rejected", recordId);
    const existing = await tx.get("outbox", recordId);
    if (!existing) {
      await tx.put("outbox", {
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

export function pendingCount(db: StorageReader): Promise<number> {
  return db.count("outbox");
}
