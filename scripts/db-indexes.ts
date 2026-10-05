/**
 * Creates every MongoDB index the app needs. Idempotent.
 * Usage: pnpm db:indexes
 */
import { closeMongoClient, getDb } from "@/server/db";
import { ensureIndexes, INDEXES } from "@/server/indexes";
import { loadEnv } from "./load-env";

async function main() {
  loadEnv();
  await ensureIndexes(await getDb());
  const total = Object.values(INDEXES).reduce((sum, list) => sum + list.length, 0);
  console.log(`Indexes ensured: ${total} across ${Object.keys(INDEXES).length} collections.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeMongoClient);
