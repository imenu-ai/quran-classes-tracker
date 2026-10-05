import { MongoMemoryServer } from "mongodb-memory-server";
import { closeMongoClient, getDb } from "@/server/db";
import { resetServerEnvForTests } from "@/server/env";

/**
 * Starts an in-memory MongoDB and points the server env at it.
 * Call in `beforeAll`; call the returned `stop` in `afterAll`.
 */
export async function startTestMongo() {
  const server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  process.env.MONGODB_DB = `test_${crypto.randomUUID().replaceAll("-", "")}`;
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  resetServerEnvForTests();
  const db = await getDb();

  return {
    db,
    async stop() {
      await closeMongoClient();
      await server.stop();
      resetServerEnvForTests();
    },
  };
}
