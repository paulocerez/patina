import { apply } from "./engine.js";
import { type Manifest, restrictSpec } from "./manifest.js";
import { migratePatch } from "./migrate.js";
import type { Patch, Skip, SurfaceSpec } from "./types.js";

/** The storage-neutral shape of a history entry. Adapters may store more fields. */
export type HistoryEntry =
  | { kind: "patch"; id: string; seq: number; patch: Patch }
  | { kind: "revert"; id: string; seq: number; targetId: string }
  | { kind: "reset"; id: string; seq: number };

/** Patches in effect: non-reverted patches after the last non-reverted reset. */
export function effectivePatches(entries: readonly HistoryEntry[]): Patch[] {
  const reverted = revertedIds(entries);
  let out: Patch[] = [];
  for (const e of [...entries].sort((a, b) => a.seq - b.seq)) {
    if (reverted.has(e.id)) continue;
    if (e.kind === "reset") out = [];
    if (e.kind === "patch") out.push(e.patch);
  }
  return out;
}

/** The entry `undo` would revert: the latest non-reverted patch or reset. */
export function undoTarget(entries: readonly HistoryEntry[]): HistoryEntry | null {
  const reverted = revertedIds(entries);
  const candidates = entries.filter(
    (e) => (e.kind === "patch" || e.kind === "reset") && !reverted.has(e.id),
  );
  return candidates.sort((a, b) => b.seq - a.seq)[0] ?? null;
}

export function headSeq(entries: readonly HistoryEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.seq), 0);
}

function revertedIds(entries: readonly HistoryEntry[]): Set<string> {
  return new Set(entries.flatMap((e) => (e.kind === "revert" ? [e.targetId] : [])));
}

export interface Layer {
  name: string;
  entries: readonly HistoryEntry[];
}

export interface Resolved {
  spec: SurfaceSpec;
  /** Stored changes that no longer apply, with reasons. */
  skipped: Skip[];
  /** Number of patches in effect across all layers. */
  patchCount: number;
}

/**
 * base → (restriction) → each layer's effective patches, in order.
 * Replay is tolerant: ops that no longer apply are skipped and reported. Never throws.
 */
export function resolve(m: Manifest<unknown>, layers: readonly Layer[]): Resolved {
  let spec = restrictSpec(m, m.base);
  const skipped: Skip[] = [];
  let patchCount = 0;
  for (const layer of layers) {
    for (const stored of effectivePatches(layer.entries)) {
      patchCount++;
      const migrated = migratePatch(m, stored, spec);
      skipped.push(
        ...migrated.skipped.map((s) => ({ ...s, patchId: stored.id, layer: layer.name })),
      );
      const r = apply(m, spec, migrated.patch, "tolerant");
      spec = r.spec;
      skipped.push(...r.skipped.map((s) => ({ ...s, patchId: stored.id, layer: layer.name })));
    }
  }
  return { spec, skipped, patchCount };
}
