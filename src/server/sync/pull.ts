import type { Db } from "mongodb";
import type { PullChanges, PullResponse } from "@/shared/sync/protocol";
import { SYNC_TABLES, type SyncRecord } from "@/shared/sync/tables";
import { createTenantRepositories, type TenantDocument } from "../repositories/tenant-repository";
import { getWatermark } from "./versions";

const emptyChanges = (): PullChanges => ({
  classes: [],
  students: [],
  lessons: [],
  attendance: [],
  homework: [],
});

function toRecord({ _id, ...fields }: TenantDocument): SyncRecord {
  return { id: _id, ...fields } as unknown as SyncRecord;
}

/**
 * Returns the tenant's records changed after `since`, oldest first, across
 * all tables, at most `limit` of them. Soft-deleted records are included so
 * deletions reach every device. Nothing above the watermark is returned, so
 * a record whose version is reserved but not yet written can't be skipped.
 */
export async function pullChanges(
  db: Db,
  tenantId: string,
  since: number,
  limit: number,
  now: Date = new Date(),
): Promise<PullResponse> {
  const watermark = await getWatermark(db, tenantId, now);
  if (watermark <= since) return { changes: emptyChanges(), cursor: since, hasMore: false };

  const repos = createTenantRepositories(db, tenantId);
  const range = { serverVersion: { $gt: since, $lte: watermark } };

  // Up to limit+1 per table is enough to fill the page and know if more remain.
  const perTable = await Promise.all(
    SYNC_TABLES.map(async (table) => {
      const docs = await repos[table]
        .find(range, { sort: { serverVersion: 1 }, limit: limit + 1 })
        .toArray();
      return docs.map((doc) => ({ table, doc }));
    }),
  );
  const merged = perTable
    .flat()
    .sort((a, b) => Number(a.doc.serverVersion) - Number(b.doc.serverVersion));

  const page = merged.slice(0, limit);
  const hasMore = merged.length > limit;

  const changes = emptyChanges();
  for (const { table, doc } of page) {
    (changes[table] as SyncRecord[]).push(toRecord(doc));
  }

  // Versions are unique per tenant across tables (one counter), so the last
  // version on a full page is an exact cursor. When the page holds everything
  // up to the watermark, jump to the watermark (gaps from stale writes).
  const last = page.at(-1);
  const cursor = hasMore && last ? Number(last.doc.serverVersion) : watermark;
  return { changes, cursor, hasMore };
}
