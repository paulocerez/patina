import type { Manifest } from "./manifest.js";
import type { Anchor, Op, Patch, Skip, SurfaceSpec } from "./types.js";

/**
 * Rewrites one op written against an older base version. Return the op (possibly changed)
 * or `null` to drop it on purpose. `spec` is the spec the op is about to be applied to.
 */
export type Migration = (op: Op, spec: SurfaceSpec) => Op | null;

const renameAnchor = (to: Anchor, from: string, next: string): Anchor => {
  if (typeof to === "string") return to;
  if ("before" in to) return to.before === from ? { before: next } : to;
  return to.after === from ? { after: next } : to;
};

/** Helpers for the common base-view changes. */
export const migrations = {
  /** A prop of a component was renamed. */
  renameProp:
    (component: string, from: string, to: string): Migration =>
    (op, spec) => {
      if (spec.nodes[op.node]?.component !== component) return op;
      if (op.op === "set") {
        if (op.path[0] !== from) return op;
        const path = [to, ...op.path.slice(1)] as typeof op.path;
        return { ...op, path };
      }
      return op.prop === from ? { ...op, prop: to } : op;
    },
  /** A key inside a collection or slot was renamed (e.g. a column "vet" → "doctor"). */
  renameKey:
    (node: string, prop: string, from: string, to: string): Migration =>
    (op) => {
      if (op.node !== node) return op;
      if (op.op === "set") {
        if (op.path.length === 3 && op.path[0] === prop && op.path[1] === from)
          return { ...op, path: [prop, to, op.path[2]] };
        return op;
      }
      if (op.prop !== prop) return op;
      if (op.op === "remove") return op.key === from ? { ...op, key: to } : op;
      return { ...op, key: op.key === from ? to : op.key, to: renameAnchor(op.to, from, to) };
    },
  /** A node was renamed. Updates ops on the node and references to it in slots. */
  renameNode:
    (from: string, to: string): Migration =>
    (op) => {
      let next: Op = op.node === from ? { ...op, node: to } : op;
      if (next.op === "set" && next.path.length === 3 && next.path[1] === from)
        next = { ...next, path: [next.path[0], to, next.path[2]] };
      if (next.op === "move" || next.op === "insert")
        next = {
          ...next,
          key: next.key === from ? to : next.key,
          to: renameAnchor(next.to, from, to),
        };
      if (next.op === "remove" && next.key === from) next = { ...next, key: to };
      return next;
    },
  /** Drops every op that targets a node, on purpose and without a skip report. */
  dropNode:
    (id: string): Migration =>
    (op) =>
      op.node === id ? null : op,
};

/**
 * Runs a stored patch through every migration between its base version and the
 * manifest's current version. Never rewrites storage: migration happens on read.
 */
export function migratePatch(
  m: Manifest<unknown>,
  patch: Patch,
  spec: SurfaceSpec,
): { patch: Patch; skipped: Skip[] } {
  if (patch.schemaVersion !== 1) {
    return {
      patch: { ...patch, ops: [] },
      skipped: (patch.ops ?? []).map((op, opIndex) => ({
        opIndex,
        op,
        code: "malformed_op" as const,
        message: "This change was saved in a format this version can't read.",
      })),
    };
  }
  if (patch.baseVersion >= m.version) return { patch, skipped: [] };
  const ops: Op[] = [];
  for (const original of patch.ops ?? []) {
    let op: Op | null = original;
    for (let v = patch.baseVersion + 1; v <= m.version && op; v++) {
      for (const step of m.migrations[v] ?? []) {
        if (!op) break;
        op = step(op, spec);
      }
    }
    if (op) ops.push(op);
  }
  return { patch: { ...patch, ops, baseVersion: m.version }, skipped: [] };
}
