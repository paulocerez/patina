import { defineConfig } from "tsup";

// ESM and CommonJS, so a CommonJS backend can `require` Patina. Types: tsc writes dist/*.d.ts,
// scripts/cjs-types.mjs copies them to dist/cjs/ for `require` and moduleResolution node10.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/anthropic.ts",
    "src/express.ts",
    "src/testing.ts",
    "src/eval.ts",
    "src/followups.ts",
    "src/integrations.ts",
    "src/drizzle.ts",
  ],
  format: ["esm", "cjs"],
  clean: true,
  external: ["@patina-ui/core", "@anthropic-ai/sdk", "drizzle-orm"],
});
