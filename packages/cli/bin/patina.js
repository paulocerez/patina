#!/usr/bin/env node
// Inside this monorepo (src/ present) run the TypeScript source with tsx, so workspace
// packages resolve to their sources. Published packages ship dist/ only.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../src/cli.ts");
let mod;
if (existsSync(src)) {
  const { register } = await import("tsx/esm/api");
  register();
  mod = await import(pathToFileURL(src).href);
} else {
  mod = await import(pathToFileURL(join(here, "../dist/cli.js")).href);
}
process.exit(await mod.main());
