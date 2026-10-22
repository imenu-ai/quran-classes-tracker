import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { COLLECTIONS } from "./collections";
import { ensureIndexes, INDEXES } from "./indexes";

describe("ensureIndexes", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
  });

  afterAll(async () => {
    await stop();
  });

  it("creates every index and is idempotent", async () => {
    await ensureIndexes(db);
    await ensureIndexes(db);

    for (const [collection, expected] of Object.entries(INDEXES)) {
      const names = (await db.collection(collection).indexes()).map((index) => index.name);
      for (const index of expected) {
        expect(names, collection).toContain(index.name);
      }
    }
  });

  it("enforces unique usernames", async () => {
    const users = db.collection(COLLECTIONS.users);
    await users.insertOne({ username: "teacher", email: "a@users.invalid" });
    await expect(
      users.insertOne({ username: "teacher", email: "b@users.invalid" }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("scopes syncable indexes by tenant and server version", async () => {
    for (const collection of ["classes", "students", "lessons", "attendance", "homework"]) {
      const indexes = await db.collection(collection).indexes();
      expect(indexes.some((index) => index.name === "tenant_version")).toBe(true);
    }
  });
});
