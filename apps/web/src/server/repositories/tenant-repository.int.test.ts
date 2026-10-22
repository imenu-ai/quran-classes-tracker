import type { Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { COLLECTIONS } from "../collections";
import { createTenantRepositories, type TenantDocument } from "./tenant-repository";

describe("TenantRepository", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
  });

  afterAll(async () => {
    await stop();
  });

  beforeEach(async () => {
    const classes = db.collection<TenantDocument>(COLLECTIONS.classes);
    await classes.deleteMany({});
    await classes.insertMany([
      { _id: "a-1", tenantId: "A", name: "حلقة أ" },
      { _id: "a-2", tenantId: "A", name: "حلقة ب" },
      { _id: "b-1", tenantId: "B", name: "Other tenant" },
    ]);
  });

  it("only reads the tenant's own documents", async () => {
    const repos = createTenantRepositories(db, "A");
    const ids = (await repos.classes.find().toArray()).map((doc) => doc._id).sort();
    expect(ids).toEqual(["a-1", "a-2"]);
    expect(await repos.classes.countDocuments()).toBe(2);
  });

  it("returns null for another tenant's document, even by _id", async () => {
    const repos = createTenantRepositories(db, "A");
    expect(await repos.classes.findById("b-1")).toBeNull();
    expect(await repos.classes.findOne({ _id: "b-1" })).toBeNull();
  });

  it("ignores a tenantId supplied in the filter", async () => {
    const repos = createTenantRepositories(db, "A");
    const docs = await repos.classes.find({ tenantId: "B" }).toArray();
    expect(docs.map((doc) => doc.tenantId)).toEqual(["A", "A"]);
  });

  it("cannot update another tenant's document", async () => {
    const repos = createTenantRepositories(db, "A");
    const result = await repos.classes.updateOne({ _id: "b-1" }, { $set: { name: "hacked" } });
    expect(result.matchedCount).toBe(0);
    const other = await db.collection(COLLECTIONS.classes).findOne({ _id: "b-1" as never });
    expect(other?.name).toBe("Other tenant");
  });

  it("cannot move a document to another tenant", async () => {
    const repos = createTenantRepositories(db, "A");
    await repos.classes.updateOne({ _id: "a-1" }, { $set: { tenantId: "B", name: "renamed" } });
    const doc = await db.collection(COLLECTIONS.classes).findOne({ _id: "a-1" as never });
    expect(doc).toMatchObject({ tenantId: "A", name: "renamed" });
  });

  it("stamps inserts with the repository's tenant", async () => {
    const repos = createTenantRepositories(db, "B");
    await repos.classes.insertOne({ _id: "b-2", name: "new" } as never);
    const doc = await db.collection(COLLECTIONS.classes).findOne({ _id: "b-2" as never });
    expect(doc?.tenantId).toBe("B");
  });
});
