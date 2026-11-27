/** Any JSON value. Specs and patches are plain JSON so they can be stored and replayed. */
export type Value = null | boolean | number | string | Value[] | { [key: string]: Value };

export type NodeId = string;

/** One entry of an ordered keyed collection (slot children, table columns, …). */
export interface CollectionItem {
  key: string;
  hidden?: boolean;
  [field: string]: Value | undefined;
}

export interface SpecNode {
  component: string;
  props: Record<string, Value>;
  /** Set by the engine on nodes created from a preset (user-inserted). */
  preset?: string;
}

export interface SurfaceSpec {
  /** Patina's own format version. */
  schemaVersion: 1;
  surfaceId: string;
  /** The host's version of this base view. Increases monotonically. */
  baseVersion: number;
  root: NodeId;
  nodes: Record<NodeId, SpecNode>;
}

/** Where a moved or inserted item lands, relative to a sibling key. */
export type Anchor = { before: string } | { after: string } | "start" | "end";

/** `[prop]` targets a whole prop; `[prop, itemKey, field]` targets a field of a collection item. */
export type Path = [prop: string] | [prop: string, itemKey: string, field: string];

export type Op =
  | { op: "set"; node: NodeId; path: Path; value: Value }
  | { op: "move"; node: NodeId; prop: string; key: string; to: Anchor }
  | {
      op: "insert";
      node: NodeId;
      prop: string;
      preset: string;
      key: string;
      to: Anchor;
      /** Settings for the new node, validated against its component's prop types. */
      props?: Record<string, Value>;
    }
  | { op: "remove"; node: NodeId; prop: string; key: string };

export interface Patch {
  id: string;
  schemaVersion: 1;
  /** The base version the patch was authored against. */
  baseVersion: number;
  ops: Op[];
  /** The model's one-line summary. Informational only; previews use `describe()`. */
  summary?: string;
}

export type IssueCode =
  | "unknown_node"
  | "unknown_prop"
  | "not_customizable"
  | "invalid_value"
  | "unknown_key"
  | "unknown_field"
  | "unknown_anchor"
  | "not_reorderable"
  | "not_hideable"
  | "preset_not_allowed"
  | "cannot_remove_base_item"
  | "duplicate_key"
  | "malformed_op";

/** A reason an op cannot be applied. `message` is written for end users. */
export interface Issue {
  opIndex: number;
  code: IssueCode;
  message: string;
}

/** An op skipped during tolerant replay. */
export interface Skip extends Issue {
  op: Op;
  patchId?: string;
  layer?: string;
}

/** A human-readable line describing one op, used for previews. */
export interface Change {
  opIndex: number;
  text: string;
}
