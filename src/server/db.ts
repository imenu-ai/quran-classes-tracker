import { MongoClient, type Db } from "mongodb";
import { getServerEnv } from "./env";

/**
 * One MongoClient per server process. On serverless (Amplify compute) a warm
 * instance reuses it; in dev the cache lives on globalThis so hot reloads
 * don't open a new connection pool each time.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __mongoClient?: Promise<MongoClient>;
};

export function getMongoClient(): Promise<MongoClient> {
  globalForMongo.__mongoClient ??= new MongoClient(getServerEnv().MONGODB_URI, {
    appName: "quran-classes-tracker",
    maxPoolSize: 10,
  }).connect();
  return globalForMongo.__mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getServerEnv().MONGODB_DB);
}

/** Closes the shared client (CLI scripts and tests). */
export async function closeMongoClient(): Promise<void> {
  const pending = globalForMongo.__mongoClient;
  globalForMongo.__mongoClient = undefined;
  if (pending) await (await pending).close();
}
