import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    clearMocks: true,
    // The first in-memory MongoDB start downloads a mongod binary.
    hookTimeout: 180_000,
  },
});
