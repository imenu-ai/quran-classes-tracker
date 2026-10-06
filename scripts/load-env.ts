import { existsSync } from "node:fs";

/**
 * Loads `.env.local` then `.env` for CLI scripts, the same files Next.js
 * reads. Variables already set in the shell win.
 */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
