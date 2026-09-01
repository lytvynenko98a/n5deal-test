import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // See test/server-only-stub.ts for why.
      "server-only": path.resolve(import.meta.dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The DB-backed tests each open their own SQLite file, so they need their
    // own process rather than a shared module cache.
    pool: "forks",
  },
});
