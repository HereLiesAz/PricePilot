import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  // Bundle the lightweight shared package (TS source). Keep @pricepilot/db
  // external: it compiles to CJS and loads the Prisma client at runtime —
  // bundling Prisma breaks its query-engine resolution.
  noExternal: ["@pricepilot/shared"],
});
