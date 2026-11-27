import { defineConfig } from "tsup";

// ESM and CommonJS. Types: tsc writes dist/*.d.ts, scripts/cjs-types.mjs copies them to
// dist/cjs/ for `require` and older TypeScript settings (moduleResolution node10).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  clean: true,
});
