/**
 * E2E test server: an in-memory MongoDB with fresh test accounts, then the
 * PRODUCTION build (`next start`, service worker included) on port 3100.
 * Started by playwright.config.ts (webServer). Set SKIP_E2E_BUILD=1 to reuse
 * an existing build in .next-e2e.
 */
import { spawn, spawnSync } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";
import { E2E_ACCOUNTS, E2E_PASSWORD, E2E_PORT } from "./accounts";

const mongo = await MongoMemoryServer.create();
const env = {
  ...process.env,
  NODE_ENV: "production" as const,
  NEXT_DIST_DIR: ".next-e2e",
  MONGODB_URI: mongo.getUri(),
  MONGODB_DB: "quran_tracker_e2e",
  BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
  ENABLED_LOCALES: "ar,en",
};
Object.assign(process.env, env);

const { ensureIndexes } = await import("../src/server/indexes");
const { getDb } = await import("../src/server/db");
const { createTeacherAccount } = await import("../src/server/accounts");
await ensureIndexes(getDb());
for (const username of E2E_ACCOUNTS) {
  await createTeacherAccount({
    tenantName: `tenant-${username}`,
    username,
    password: E2E_PASSWORD,
    name: "معلم الاختبار",
    // The LTR smoke accounts are English users: sign-in copies user.locale
    // into the NEXT_LOCALE cookie, exactly like a real English teacher.
    locale: username.startsWith("e2e_ltr_") ? "en" : "ar",
  });
}
console.log(`[e2e] MongoDB ready, ${E2E_ACCOUNTS.length} accounts created`);

if (!process.env.SKIP_E2E_BUILD) {
  const build = spawnSync("pnpm", ["exec", "next", "build"], {
    env,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn("pnpm", ["exec", "next", "start", "-p", String(E2E_PORT)], {
  env,
  stdio: "inherit",
  shell: true,
});
const stop = async () => {
  server.kill();
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
server.on("exit", (code) => void mongo.stop().then(() => process.exit(code ?? 0)));
