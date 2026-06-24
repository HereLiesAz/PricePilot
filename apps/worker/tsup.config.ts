import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  // Bundle the TS-source workspace packages; keep @sail/db (CJS + Prisma)
  // and third-party deps (bullmq, ioredis, web-push, …) external.
  noExternal: ["@sail/shared", "@sail/scrapers"],
});
