import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  "coverage",
  "vendor",
  ".cache",
  ".context",
  ".packs",
  "tmp",
  ".idea",
  ".vscode",
]);
const MAX_FILES = 20_000;
export const MAX_FILE_BYTES = 400_000;

/** Never read, never sent anywhere. */
export const SECRET_PATTERNS = [
  /(^|\/)\.env(\.|$)/,
  /secret/i,
  /credential/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /\.p12$/,
];

export function isSecretPath(p: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(p));
}

/**
 * Lists repo files fast: `git ls-files` when available (respects .gitignore), else a
 * bounded directory walk. Paths are relative, with forward slashes.
 */
export function listFiles(root: string): string[] {
  try {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = out.split("\n").filter(Boolean);
    if (files.length)
      return files
        .filter((f) => !f.split("/").some((part) => SKIP_DIRS.has(part)) && !isSecretPath(f))
        .slice(0, MAX_FILES);
  } catch {
    // not a git repo: walk
  }
  const files: string[] = [];
  const walk = (dir: string) => {
    if (files.length >= MAX_FILES) return;
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full, { throwIfNoEntry: false });
      if (!st) continue;
      if (st.isDirectory()) walk(full);
      else files.push(relative(root, full).split(sep).join("/"));
    }
  };
  walk(root);
  return files.filter((f) => !isSecretPath(f));
}

export class Repo {
  readonly files: string[];
  private cache = new Map<string, string | null>();
  constructor(readonly root: string) {
    this.files = listFiles(root);
  }
  read(file: string): string | null {
    if (this.cache.has(file)) return this.cache.get(file) ?? null;
    let text: string | null = null;
    try {
      const full = join(this.root, file);
      if (statSync(full).size <= MAX_FILE_BYTES) text = readFileSync(full, "utf8");
    } catch {
      text = null;
    }
    this.cache.set(file, text);
    return text;
  }
  find(re: RegExp): string[] {
    return this.files.filter((f) => re.test(f));
  }
}
