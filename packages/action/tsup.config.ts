import { defineConfig } from "tsup";

// One self-contained file: GitHub runs dist/index.cjs without installing dependencies.
export default defineConfig({
  entry: { index: "../cli/src/action-main.ts" },
  format: ["cjs"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".cjs" }),
});
