import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default("quran_tracker"),
  /** At least 32 random characters, e.g. `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Public base URL of the app, e.g. http://localhost:3000 */
  BETTER_AUTH_URL: z.url(),
  ENABLED_LOCALES: z.string().default("ar"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Validated server environment. Read lazily (not at import time) so builds
 * and tests that never touch the server don't need every variable set.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing server environment variables: ${fields}`);
  }
  cached = result.data;
  return cached;
}

/** Test-only: forget the cached environment. */
export function resetServerEnvForTests() {
  cached = undefined;
}
