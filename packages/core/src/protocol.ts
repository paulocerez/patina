import type { Capabilities } from "./capabilities.js";
/** Wire types shared by `@patina-ui/server` and client bindings. */
import type { PublicCatalog } from "./catalog.js";
import type { Change, Op, SurfaceSpec } from "./types.js";

/** Body of GET /surfaces/:id and of successful commit, undo and reset. */
/** "You asked for X. It's now possible." */
export interface Notice {
  /** The follow-up key (pf-…). */
  key: string;
  /** What they asked for, as the follow-up's title. */
  title: string;
  /** The host's own text, if it set one when shipping; otherwise show `msg("shipped", { title })`. */
  message: string | null;
  shippedAt: string;
}

export interface SurfaceState {
  /** What this user can ask for here (see `capabilities`), in their language. */
  capabilities?: Capabilities;
  surfaceId: string;
  spec: SurfaceSpec;
  /** Earlier changes that no longer apply. */
  skipped: { message: string; patchId?: string }[];
  canUndo: boolean;
  /** Whether the last undo can be taken back (POST /surfaces/:id/redo). */
  canRedo?: boolean;
  /**
   * The user's history position. Send it back as `expectedSeq` with undo, redo and reset: the
   * server answers 409 instead of undoing a step the user didn't see (double clicks).
   */
  seq?: number;
  isCustomized: boolean;
  /** Which props are slots and which are collections, per component, for the renderer. */
  render: { slots: Record<string, string[]>; collections: Record<string, string[]> };
  /** The user's data sources (restricted, no sensitive fields), for data blocks. */
  catalog?: PublicCatalog;
  /** The locale messages and previews are in (en, de). */
  locale?: string;
  /**
   * Things this user asked for that weren't possible then and are now (shipped follow-ups).
   * Sent with GET only; dismiss with POST /surfaces/:id/notices/:key/dismiss.
   */
  notices?: Notice[];
  /** What this user may do here (from the host's `availability` hook). */
  availability: {
    /** May change this view at all (prompt, apply, undo, reset). */
    customize: boolean;
    /** May create or edit data views (new charts, tables and cards from the catalog). */
    dataViews: boolean;
    /** Shown to the user when something is unavailable. */
    message?: string;
  };
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
  | {
      kind: "refusal";
      message: string;
      /** Why (see `REFUSAL_CATEGORIES`), when known. */
      category?: string;
    }
  | {
      kind: "clarify";
      question: string;
      /**
       * Choices the user can pick, each checked to be possible. Send the picked label (or any
       * reply) back as the next prompt with `thread: { prompt, question }`.
       */
      options?: { label: string }[];
    }
  | {
      /** The user asked what is possible: answered from the manifest, not by the model. */
      kind: "answer";
      message: string;
      /** Same as `message`, so clients from before 0.7 (which show `question`) show it too. */
      question: string;
      /** What the user can change, narrowed to what they asked about. */
      capabilities: Capabilities;
    };

/**
 * Body of POST /surfaces/:id/proposals. `thread` carries the question this prompt answers
 * (one clarification at most: the server won't ask again).
 */
export interface ProposeRequest {
  prompt: string;
  thread?: { prompt: string; question: string };
}

/** Body of POST /surfaces/:id/undo, /redo and /reset. All optional. */
export interface HistoryRequest {
  /** `SurfaceState.seq` as the client saw it. A different head answers 409. */
  expectedSeq?: number;
}

/** Body of any non-2xx response. */
export interface ErrorBody {
  error: { message: string };
}
