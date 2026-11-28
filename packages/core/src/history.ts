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

/**
 * The undo that `redo` would take back: the latest revert still in effect, as long as no change
 * was made after it (a new change ends the redo chain, like in any editor). Redo appends a
 * revert of this revert.
 */
export function redoTarget(entries: readonly HistoryEntry[]): HistoryEntry | null {
  const reverted = revertedIds(entries);
  const sorted = [...entries].sort((a, b) => b.seq - a.seq);
  for (const e of sorted) {
    if (reverted.has(e.id)) continue;
    if (e.kind === "revert") {
      // An earlier redo (a revert of a revert): look past it for the next undo to redo.
      if (entries.find((x) => x.id === e.targetId)?.kind === "revert") continue;
      return e;
    }
    return null; // a patch or reset after the last undo: nothing to redo
  }
  return null;
}

export function headSeq(entries: readonly HistoryEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.seq), 0);
}

/**
 * Entries that are reverted. A revert that is itself reverted (redo) doesn't count, so its
 * target is back in effect. Reverts always target earlier entries, so one pass from the newest
 * entry down settles every case.
 */
function revertedIds(entries: readonly HistoryEntry[]): Set<string> {
  const reverted = new Set<string>();
  for (const e of [...entries].sort((a, b) => b.seq - a.seq))
    if (e.kind === "revert" && !reverted.has(e.id)) reverted.add(e.targetId);
  return reverted;
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
