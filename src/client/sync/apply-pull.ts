import { shouldApplyIncoming } from "@/shared/sync/lww";
import type { PullResponse } from "@/shared/sync/protocol";
import { SYNC_TABLES, type SyncRecord } from "@/shared/sync/tables";
import type { LocalDb } from "../db/dexie";

export const CURSOR_KEY = "cursor";

export async function getCursor(db: LocalDb): Promise<number> {
  const value = (await db.meta.get(CURSOR_KEY))?.value;
  return typeof value === "number" ? value : 0;
}

/**
 * Applies one page of pulled changes and advances the cursor, atomically.
 * A pulled record replaces the local copy unless the device has a pending
 * edit that is newer; if the server copy wins over a pending edit, that edit
 * is dropped from the outbox (the server already holds something newer).
 */
export async function applyPulledChanges(
  db: LocalDb,
  { changes, cursor }: Pick<PullResponse, "changes" | "cursor">,
): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;
  const tables = [...SYNC_TABLES.map((table) => db.syncTable(table)), db.outbox, db.meta];

  await db.transaction("rw", tables, async () => {
    for (const table of SYNC_TABLES) {
      const store = db.syncTable(table);
      for (const incoming of changes[table] as SyncRecord[]) {
        const local = await store.get(incoming.id);
        const pending = await db.outbox.get(incoming.id);
        if (!shouldApplyIncoming(local, incoming, pending !== undefined)) {
          skipped += 1;
          continue;
        }
        await store.put(incoming as never);
        if (pending) await db.outbox.delete(incoming.id);
        applied += 1;
      }
    }
    await db.meta.put({ key: CURSOR_KEY, value: cursor });
  });

  return { applied, skipped };
}
