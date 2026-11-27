import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  clean: true,
  external: ["react", "@patina-ui/core"],
  // Hooks and components: mark the bundle as client-only for React Server Components (Next.js).
  banner: { js: '"use client";' },
});
