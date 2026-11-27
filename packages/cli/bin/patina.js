#!/usr/bin/env node
// Published builds run dist/cli.js; inside this monorepo, run the TypeScript source with tsx.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "../dist/cli.js");
let mod;
if (existsSync(dist)) {
  mod = await import(pathToFileURL(dist).href);
} else {
  const { register } = await import("tsx/esm/api");
  register();
  mod = await import(pathToFileURL(join(here, "../src/cli.ts")).href);
}
process.exit(await mod.main());
