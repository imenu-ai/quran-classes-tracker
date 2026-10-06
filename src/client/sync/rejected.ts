import { CURSOR_KEY } from "./apply-pull";
import type { LocalDb } from "../db/dexie";

/**
 * Gives up on a change the server refused. Only the teacher can do this.
 * - Never synced (serverVersion 0): the record exists only on this device,
 *   so it is removed locally.
 * - Synced before: the local copy has edits the server refused, so the
 *   cursor is reset and the next sync brings back the server's version.
 */
export async function discardRejected(db: LocalDb, recordId: string): Promise<void> {
  await db.transaction("rw", [db.rejected, db.meta, ...db.tables], async () => {
    const rejected = await db.rejected.get(recordId);
    if (!rejected) return;
    await db.rejected.delete(recordId);
    const table = db.syncTable(rejected.table);
    const record = await table.get(recordId);
    if (!record) return;
    if (record.serverVersion === 0) {
      await table.delete(recordId);
    } else {
      await db.meta.put({ key: CURSOR_KEY, value: 0 });
    }
  });
}
