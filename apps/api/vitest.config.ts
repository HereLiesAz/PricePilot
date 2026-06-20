import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // Integration suites share one Postgres and truncate between tests — run
    // test files serially so they don't wipe each other's data concurrently.
    fileParallelism: false,
  },
});
