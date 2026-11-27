// Copies a package's declaration files (dist/**/*.d.ts) to dist/cjs/, next to a package.json
// that marks them as CommonJS. The "require" export condition and `typesVersions` point there,
// so CommonJS consumers and moduleResolution node10 get types that match the .cjs build.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const out = join(dist, "cjs");
if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });

let count = 0;
function copy(dir, rel = "") {
  for (const name of readdirSync(join(dir, rel))) {
    const from = join(dir, rel, name);
    if (from === out) continue;
    if (statSync(from).isDirectory()) copy(dir, join(rel, name));
    else if (name.endsWith(".d.ts")) {
      mkdirSync(join(out, rel), { recursive: true });
      cpSync(from, join(out, rel, name));
      count++;
    }
  }
}
copy(dist);
writeFileSync(join(out, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
console.log(`cjs-types: ${count} declaration files → dist/cjs/`);
