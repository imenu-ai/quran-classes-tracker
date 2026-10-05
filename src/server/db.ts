import { MongoClient, type Db } from "mongodb";
import { getServerEnv } from "./env";

/**
 * One MongoClient per server process. On serverless (Amplify compute) a warm
 * instance reuses it; in dev the cache lives on globalThis so hot reloads
 * don't open a new connection pool each time. The driver connects lazily on
 * the first operation, so this is synchronous.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __mongoClient?: MongoClient;
};

export function getMongoClient(): MongoClient {
  globalForMongo.__mongoClient ??= new MongoClient(getServerEnv().MONGODB_URI, {
    appName: "quran-classes-tracker",
    maxPoolSize: 10,
  });
  return globalForMongo.__mongoClient;
}

export function getDb(): Db {
  return getMongoClient().db(getServerEnv().MONGODB_DB);
}

/** Closes the shared client (CLI scripts and tests). */
export async function closeMongoClient(): Promise<void> {
  const client = globalForMongo.__mongoClient;
  globalForMongo.__mongoClient = undefined;
  await client?.close();
}
