import type { Db } from "mongodb";
import type { TenantDoc } from "./accounts";
import { COLLECTIONS } from "./collections";

/** The tenant record itself (not tenant-scoped data). */
export function getTenant(db: Db, tenantId: string) {
  return db.collection<TenantDoc>(COLLECTIONS.tenants).findOne({ _id: tenantId });
}
