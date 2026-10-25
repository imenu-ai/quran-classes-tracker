import { shouldApplyIncoming } from "../../shared/sync/lww";
import type { PullResponse } from "../../shared/sync/protocol";
import { SYNC_TABLES, type SyncRecord } from "../../shared/sync/tables";
import type { LocalDatabase } from "../database";
import type { StorageReader } from "../storage";

export const CURSOR_KEY = "cursor";

export async function getCursor(db: StorageReader): Promise<number> {
  const value = (await db.get("meta", CURSOR_KEY))?.value;
  return typeof value === "number" ? value : 0;
}

/**
 * Applies one page of pulled changes and advances the cursor, atomically.
 * A pulled record replaces the local copy unless the device has a pending
 * edit that is newer; if the server copy wins over a pending edit, that edit
 * is dropped from the outbox (the server already holds something newer).
 * Reads and writes go per table in bulk (a first sync brings thousands).
 */
export async function applyPulledChanges(
  db: LocalDatabase,
  { changes, cursor }: Pick<PullResponse, "changes" | "cursor">,
): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    for (const table of SYNC_TABLES) {
      const incoming = changes[table] as SyncRecord[];
      if (incoming.length === 0) continue;
      const ids = incoming.map((record) => record.id);
      const [locals, pendings] = await Promise.all([
        tx.bulkGet(table, ids),
        tx.bulkGet("outbox", ids),
      ]);
      // The latest local copy and pending flag per id (a page may repeat an id).
      const local = new Map<string, SyncRecord | undefined>(ids.map((id, i) => [id, locals[i]]));
      const pending = new Set(ids.filter((_, i) => pendings[i] !== undefined));

      const toPut = new Map<string, SyncRecord>();
      const settled = new Set<string>();
      for (const record of incoming) {
        if (!shouldApplyIncoming(local.get(record.id), record, pending.has(record.id))) {
          skipped += 1;
          continue;
        }
        toPut.set(record.id, record);
        local.set(record.id, record);
        if (pending.delete(record.id)) settled.add(record.id);
        applied += 1;
      }
      await tx.bulkPut(table, [...toPut.values()] as never[]);
      await tx.bulkDelete("outbox", [...settled]);
    }
    await tx.put("meta", { key: CURSOR_KEY, value: cursor });
  });

  return { applied, skipped };
}
