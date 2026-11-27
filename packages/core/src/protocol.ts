/** Wire types shared by `@patina-ui/server` and client bindings. */
import type { PublicCatalog } from "./catalog.js";
import type { Change, Op, SurfaceSpec } from "./types.js";

/** Body of GET /surfaces/:id and of successful commit, undo and reset. */
export interface SurfaceState {
  surfaceId: string;
  spec: SurfaceSpec;
  /** Earlier changes that no longer apply. */
  skipped: { message: string; patchId?: string }[];
  canUndo: boolean;
  isCustomized: boolean;
  /** Which props are slots and which are collections, per component, for the renderer. */
  render: { slots: Record<string, string[]>; collections: Record<string, string[]> };
  /** The user's data sources (restricted, no sensitive fields), for data blocks. */
  catalog?: PublicCatalog;
}

/** Body of POST /surfaces/:id/proposals. */
export type ProposeResponse =
  | {
      kind: "proposal";
      proposalId: string;
      ops: Op[];
      /** Generated from the ops, not by the model. Show these in the preview. */
      changes: Change[];
      summary: string;
      previewSpec: SurfaceSpec;
    }
  | { kind: "refusal"; message: string }
  | { kind: "clarify"; question: string };

/** Body of any non-2xx response. */
export interface ErrorBody {
  error: { message: string };
}
