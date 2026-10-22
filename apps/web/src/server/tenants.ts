import type { Db } from "mongodb";
import { COLLECTIONS } from "./collections";

/** A center. Every user and record belongs to exactly one. */
export interface TenantDoc {
  _id: string;
  name: string;
  /** 6 digits, unique. Typed at sign-in, before the username. */
  code: string;
  timezone: string;
  createdAt: Date;
}

export const tenantsCollection = (db: Db) => db.collection<TenantDoc>(COLLECTIONS.tenants);

/** The tenant record itself (not tenant-scoped data). */
export function getTenant(db: Db, tenantId: string) {
  return tenantsCollection(db).findOne({ _id: tenantId });
}
