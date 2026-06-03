import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  // Bundle internal workspace packages (TS source) so `node dist/index.js`
  // runs standalone; keep third-party deps external.
  noExternal: ["@pricepilot/shared"],
});
