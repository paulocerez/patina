// Bundles the canonical agent skill (repo root skills/patina-ui/SKILL.md) into the package.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "../skill"), { recursive: true });
copyFileSync(join(here, "../../../skills/patina-ui/SKILL.md"), join(here, "../skill/SKILL.md"));
