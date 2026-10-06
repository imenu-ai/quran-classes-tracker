import type { Db, Filter } from "mongodb";
import { parseWithCodes } from "@/shared/schemas/errors";
import { clampUpdatedAt } from "@/shared/sync/lww";
import type { PushMutation, PushResult } from "@/shared/sync/protocol";
import { RECORD_SCHEMAS, REFERENCES, type SyncRecord, type SyncTable } from "@/shared/sync/tables";
import {
  createTenantRepositories,
  type TenantDocument,
  type TenantRepositories,
} from "../repositories/tenant-repository";
import { allocateVersions } from "./versions";

interface ValidMutation {
  table: SyncTable;
  record: SyncRecord;
}

const recordIdOf = (record: Record<string, unknown>) =>
  typeof record.id === "string" ? record.id : "";

/** Stored shape: the record without `id` (it becomes `_id`). */
function toDocumentFields(record: SyncRecord, serverVersion: number, updatedAt: number) {
  const { id: _id, tenantId: _tenantId, ...fields } = record;
  return { ...fields, updatedAt, serverVersion };
}

/** Matches a stored copy that the incoming write beats (see isNewer in shared/sync/lww). */
function olderThan(updatedAt: number, updatedBy: string): Filter<TenantDocument> {
  return {
    $or: [{ updatedAt: { $lt: updatedAt } }, { updatedAt, updatedBy: { $lt: updatedBy } }],
  };
}

async function findMissingReference(
  repos: TenantRepositories,
  table: SyncTable,
  record: SyncRecord,
): Promise<{ field: string } | null> {
  for (const reference of REFERENCES[table]) {
    const value = (record as unknown as Record<string, unknown>)[reference.field];
    if (value === null || value === undefined) continue;
    // Soft-deleted parents still count: history must stay linkable.
    const exists = await repos[reference.table].countDocuments(
      { _id: String(value) },
      { limit: 1 },
    );
    if (!exists) return { field: reference.field };
  }
  return null;
}

/**
 * Applies a batch of client mutations for one tenant, in order.
 *
 * For each record: validate with the shared schema (including sura/ayah
 * rules), force the session's tenant, check references exist in this tenant
 * (parents earlier in the same batch count, since they're written first),
 * clamp the device clock, and write only if the incoming copy is newer.
 */
export async function pushChanges(
  db: Db,
  tenantId: string,
  mutations: readonly PushMutation[],
  now: number = Date.now(),
): Promise<PushResult[]> {
  const repos = createTenantRepositories(db, tenantId);
  const results: PushResult[] = new Array(mutations.length);
  const valid: { index: number; mutation: ValidMutation }[] = [];

  mutations.forEach((mutation, index) => {
    const id = recordIdOf(mutation.record);
    // The client's tenantId is never trusted: the session decides.
    const parsed = parseWithCodes(RECORD_SCHEMAS[mutation.table], { ...mutation.record, tenantId });
    if (!parsed.success) {
      const [first] = parsed.errors;
      results[index] = {
        id,
        table: mutation.table,
        status: "rejected",
        code: first?.code ?? "INVALID",
        params: { ...first?.params, field: first?.path ?? "" },
      };
      return;
    }
    valid.push({ index, mutation: { table: mutation.table, record: parsed.data as SyncRecord } });
  });

  if (valid.length === 0) return results;

  const allocation = await allocateVersions(db, tenantId, valid.length);
  try {
    for (const [offset, { index, mutation }] of valid.entries()) {
      results[index] = await applyOne(repos, mutation, allocation.from + offset, now);
    }
  } finally {
    await allocation.release();
  }
  return results;
}

async function applyOne(
  repos: TenantRepositories,
  { table, record }: ValidMutation,
  serverVersion: number,
  now: number,
): Promise<PushResult> {
  const base = { id: record.id, table };
  const repo = repos[table];

  // Refuse an id that another tenant already uses, without touching it.
  if (await repo.existsInOtherTenant(record.id)) {
    return { ...base, status: "rejected", code: "FORBIDDEN" };
  }

  const missing = await findMissingReference(repos, table, record);
  if (missing) {
    return { ...base, status: "rejected", code: "REFERENCE_NOT_FOUND", params: missing };
  }

  const updatedAt = clampUpdatedAt(record.updatedAt, now);
  const outcome = await repo.upsertWhere(
    record.id,
    olderThan(updatedAt, record.updatedBy),
    toDocumentFields(record, serverVersion, updatedAt),
  );
  if (outcome === "written") return { ...base, status: "applied", serverVersion };

  // The id exists in this tenant and is at least as new: nothing to do.
  return { ...base, status: "stale" };
}
