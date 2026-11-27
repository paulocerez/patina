import { dirname, relative } from "node:path";
import type { Repo } from "./files.js";
import type { ScannedComponent, ScanResult } from "./types.js";

const STYLE_FILE = /\.(css|scss|sass|less|pcss)$/;
/** Class names blocks know how to use, if the app defines them. */
const USEFUL_CLASSES = [
  "card",
  "panel",
  "surface",
  "muted",
  "badge",
  "table",
  "stat",
  "stat-label",
  "stat-value",
  "empty",
  "chip",
];
const COMPONENT_NAMES = [
  "Card",
  "CardHeader",
  "CardTitle",
  "CardContent",
  "Table",
  "TableHeader",
  "TableBody",
  "TableRow",
  "TableHead",
  "TableCell",
  "Badge",
  "Skeleton",
];

export function detectDesign(repo: Repo, outDir: string): ScanResult["design"] {
  const cssVariables: Record<string, string> = {};
  const classes = new Set<string>();
  for (const file of repo.find(STYLE_FILE).slice(0, 200)) {
    const css = repo.read(file);
    if (!css) continue;
    // Variables on :root, html, .light, [data-theme] and Tailwind v4 @theme blocks.
    for (const block of css.matchAll(
      /(?::root|html|\.light|\[data-theme[^\]]*\]|@theme[^{]*)\s*\{([^}]*)\}/g,
    )) {
      for (const v of (block[1] ?? "").matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
        const name = v[1] as string;
        if (!(name in cssVariables) && Object.keys(cssVariables).length < 80)
          cssVariables[name] = (v[2] as string).trim();
      }
    }
    for (const c of USEFUL_CLASSES) if (new RegExp(`\\.${c}(?![\\w-])`).test(css)) classes.add(c);
  }

  const aliases = readAliases(repo);
  const components: ScannedComponent[] = [];
  const candidates = repo
    .find(/(^|\/)components\/.+\.(tsx|jsx)$/)
    .filter((f) => !/\.(test|spec|stories)\./.test(f));
  for (const file of candidates.slice(0, 400)) {
    const base = file
      .split("/")
      .pop()
      ?.replace(/\.(tsx|jsx)$/, "")
      .toLowerCase();
    if (
      !base ||
      !COMPONENT_NAMES.some(
        (n) =>
          n.toLowerCase() === base ||
          base === n.toLowerCase().replace(/(header|title|content|body|row|head|cell)$/, ""),
      )
    )
      continue;
    const src = repo.read(file) ?? "";
    const exported = new Set<string>();
    for (const m of src.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z]\w*)/g))
      exported.add(m[1] as string);
    for (const m of src.matchAll(/export\s*\{([^}]+)\}/g))
      for (const part of (m[1] as string).split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name && /^[A-Z]/.test(name)) exported.add(name);
      }
    for (const name of exported) {
      if (!COMPONENT_NAMES.includes(name) || components.some((c) => c.name === name)) continue;
      components.push({ name, file, importPath: importPathFor(file, outDir, aliases) });
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  return { cssVariables, classes: [...classes].sort(), components };
}

/** tsconfig "paths" like { "@/*": ["./src/*"] } → [["@/", "src/"]]. */
function readAliases(repo: Repo): [string, string][] {
  const out: [string, string][] = [];
  for (const file of ["tsconfig.json", "tsconfig.app.json", "jsconfig.json"]) {
    const text = repo.read(file);
    if (!text) continue;
    try {
      const json = JSON.parse(text.replace(/\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };
      const baseUrl = (json.compilerOptions?.baseUrl ?? ".").replace(/^\.\/?/, "");
      for (const [alias, targets] of Object.entries(json.compilerOptions?.paths ?? {})) {
        const target = targets[0];
        if (!alias.endsWith("/*") || !target?.endsWith("/*")) continue;
        const dir = [baseUrl, target.slice(0, -2).replace(/^\.\/?/, "")].filter(Boolean).join("/");
        out.push([alias.slice(0, -1), dir ? `${dir}/` : ""]);
      }
    } catch {
      // ignore
    }
  }
  return out;
}

function importPathFor(file: string, outDir: string, aliases: [string, string][]): string {
  const noExt = file.replace(/\.(tsx|jsx)$/, "").replace(/\/index$/, "");
  for (const [alias, dir] of aliases)
    if (noExt.startsWith(dir)) return alias + noExt.slice(dir.length);
  let rel = relative(outDir, noExt).split("\\").join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

export const _test = { readAliases, importPathFor, dirname };
