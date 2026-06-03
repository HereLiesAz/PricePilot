import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  // Bundle the lightweight TS-source workspace packages. Keep @pricepilot/db
  // external: it compiles to CJS and loads the Prisma client at runtime —
  // bundling Prisma breaks its query-engine resolution. Third-party deps
  // (cheerio, playwright-core) stay external too.
  noExternal: ["@pricepilot/shared", "@pricepilot/scrapers", "@pricepilot/intel"],
});
