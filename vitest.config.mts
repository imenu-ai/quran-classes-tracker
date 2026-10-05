import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  // tsconfig keeps JSX as-is for Next.js; tests need it compiled.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    clearMocks: true,
    // The first in-memory MongoDB start downloads a mongod binary.
    hookTimeout: 180_000,
  },
});
