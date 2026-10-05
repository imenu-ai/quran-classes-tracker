import type {
  Collection,
  CountDocumentsOptions,
  Db,
  Document,
  Filter,
  FindOptions,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
} from "mongodb";
import { SYNCABLE_COLLECTIONS, type SyncableCollection } from "../collections";

/** Every tenant-owned document has a string id and the owning tenant. */
export interface TenantDocument extends Document {
  _id: string;
  tenantId: string;
}

/**
 * The only way server code reaches tenant data. Every read, count and write is
 * scoped to one tenant: the tenant filter is applied last, so a caller can
 * never widen it, and writes can never change a document's tenant.
 */
export class TenantRepository<TDoc extends TenantDocument> {
  constructor(
    private readonly collection: Collection<TDoc>,
    readonly tenantId: string,
  ) {}

  /** `filter` narrowed to this tenant. A `tenantId` in `filter` is overridden. */
  scope(filter: Filter<TDoc> = {}): Filter<TDoc> {
    return { ...filter, tenantId: this.tenantId } as Filter<TDoc>;
  }

  find(filter: Filter<TDoc> = {}, options?: FindOptions) {
    return this.collection.find(this.scope(filter), options);
  }

  findOne(filter: Filter<TDoc> = {}, options?: FindOptions) {
    return this.collection.findOne(this.scope(filter), options);
  }

  findById(id: string) {
    return this.findOne({ _id: id } as Filter<TDoc>);
  }

  countDocuments(filter: Filter<TDoc> = {}, options?: CountDocumentsOptions) {
    return this.collection.countDocuments(this.scope(filter), options);
  }

  insertOne(doc: Omit<TDoc, "tenantId">) {
    return this.collection.insertOne({
      ...doc,
      tenantId: this.tenantId,
    } as OptionalUnlessRequiredId<TDoc>);
  }

  updateOne(filter: Filter<TDoc>, update: UpdateFilter<TDoc>, options?: UpdateOptions) {
    return this.collection.updateOne(this.scope(filter), withoutTenantChange(update), options);
  }
}

/** Removes any attempt to set or unset tenantId from an update. */
function withoutTenantChange<TDoc>(update: UpdateFilter<TDoc>): UpdateFilter<TDoc> {
  const safe: Record<string, unknown> = { ...update };
  for (const operator of ["$set", "$unset", "$setOnInsert", "$rename"]) {
    const fields = safe[operator];
    if (fields && typeof fields === "object" && "tenantId" in fields) {
      const { tenantId: _ignored, ...rest } = fields as Record<string, unknown>;
      safe[operator] = rest;
    }
  }
  return safe as UpdateFilter<TDoc>;
}

export type TenantRepositories = Record<SyncableCollection, TenantRepository<TenantDocument>>;

/** Tenant-scoped repositories for every syncable collection. */
export function createTenantRepositories(db: Db, tenantId: string): TenantRepositories {
  return Object.fromEntries(
    SYNCABLE_COLLECTIONS.map((name) => [
      name,
      new TenantRepository(db.collection<TenantDocument>(name), tenantId),
    ]),
  ) as TenantRepositories;
}
