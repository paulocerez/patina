import { detectSources } from "./data.js";
import { detectDesign } from "./design.js";
import { Repo } from "./files.js";
import { detectStack } from "./stack.js";
import type { ScanResult } from "./types.js";

export interface ScanOptions {
  /** Where generated files go, relative to root. Default "patina". */
  outDir?: string;
}

/** Scans a repository for its data sources and design system. Deterministic and offline. */
export function scanRepo(root: string, options: ScanOptions = {}): ScanResult {
  const repo = new Repo(root);
  const outDir = options.outDir ?? "patina";
  return {
    version: 1,
    stack: detectStack(repo),
    design: detectDesign(repo, outDir),
    sources: detectSources(repo),
  };
}

export type { ScannedComponent, ScannedField, ScannedSource, ScanResult, UiKit } from "./types.js";
