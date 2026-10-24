import type { LocalDatabase } from "../database";
import { CURSOR_KEY } from "./apply-pull";

/**
 * Gives up on a change the server refused. Only the teacher can do this.
 * - Never synced (serverVersion 0): the record exists only on this device,
 *   so it is removed locally.
 * - Synced before: the local copy has edits the server refused, so the
 *   cursor is reset and the next sync brings back the server's version.
 */
export async function discardRejected(db: LocalDatabase, recordId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const rejected = await tx.get("rejected", recordId);
    if (!rejected) return;
    await tx.delete("rejected", recordId);
    const record = await tx.get(rejected.table, recordId);
    if (!record) return;
    if (record.serverVersion === 0) {
      await tx.delete(rejected.table, recordId);
    } else {
      await tx.put("meta", { key: CURSOR_KEY, value: 0 });
    }
  });
}
