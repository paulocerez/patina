import { type Catalog, fieldLabel, offerableFields } from "./catalog.js";
import type { Text } from "./i18n.js";
import type { AggOp, QueryDef, QueryShape } from "./query.js";

/**
 * The closed type DSL used to declare what may be customized.
 *
 * There is deliberately no URL, HTML, CSS, script or open-object type: a manifest built
 * from these types cannot open those doors even by mistake.
 */

export interface TypeMeta {
  /** Short human name, used in previews and error messages ("Rows per page"). */
  label?: Text;
  /** Written for the model: what this prop does. */
  description?: Text;
}

export type TypeDef =
  | ({ kind: "enum"; values: string[]; labels?: Record<string, Text> } & TypeMeta)
  | ({ kind: "int"; min: number; max: number } & TypeMeta)
  | ({ kind: "bool" } & TypeMeta)
  | ({ kind: "label"; maxLen: number } & TypeMeta)
  | ({ kind: "relativeDateRange"; allowed: RelativeRange[] } & TypeMeta)
  | ({ kind: "sort"; keys: string[] } & TypeMeta)
  | ({ kind: "object"; fields: Record<string, ScalarTypeDef> } & TypeMeta)
  | QueryDef
  | CollectionDef
  | SlotDef;

export type ScalarTypeDef = Exclude<
  TypeDef,
  CollectionDef | SlotDef | QueryDef | { kind: "object" }
>;

export interface CollectionDef extends TypeMeta {
  kind: "collection";
  /** Every key that may appear. Fixed by the host. */
  keys: string[];
  /** Human names for keys ("revenue" → "Revenue"). Trusted host copy. */
  labels?: Record<string, Text>;
  reorder: boolean;
  hide: boolean;
  /** Extra per-item fields the user may set. */
  item: Record<string, ScalarTypeDef>;
  /** Set by `keysFrom`: the catalog source whose fields are the keys. */
  source?: string;
}

export interface SlotDef extends TypeMeta {
  kind: "slot";
  /** Components that may live in this slot. */
  accepts: string[];
  reorder: boolean;
  hide: boolean;
  /** Preset IDs the user may insert here. */
  insert: string[];
}

export const RELATIVE_RANGES = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "last7Days",
  "last30Days",
  "last90Days",
  "thisYear",
] as const;
export type RelativeRange = (typeof RELATIVE_RANGES)[number];

export const RELATIVE_RANGE_LABELS: Record<RelativeRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  lastWeek: "Last week",
  thisMonth: "This month",
  lastMonth: "Last month",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  last90Days: "Last 90 days",
  thisYear: "This year",
};

export const t = {
  enum: (values: string[], meta: TypeMeta & { labels?: Record<string, Text> } = {}) =>
    ({ kind: "enum", values, ...meta }) as const satisfies TypeDef,
  int: (range: { min: number; max: number }, meta: TypeMeta = {}) =>
    ({ kind: "int", ...range, ...meta }) as const satisfies TypeDef,
  bool: (meta: TypeMeta = {}) => ({ kind: "bool", ...meta }) as const satisfies TypeDef,
  label: (opts: { maxLen: number }, meta: TypeMeta = {}) =>
    ({ kind: "label", ...opts, ...meta }) as const satisfies TypeDef,
  relativeDateRange: (allowed: RelativeRange[], meta: TypeMeta = {}) =>
    ({ kind: "relativeDateRange", allowed, ...meta }) as const satisfies TypeDef,
  sort: (keys: string[], meta: TypeMeta = {}) =>
    ({ kind: "sort", keys, ...meta }) as const satisfies TypeDef,
  object: (fields: Record<string, ScalarTypeDef>, meta: TypeMeta = {}) =>
    ({ kind: "object", fields, ...meta }) as const satisfies TypeDef,
  /**
   * A keyed list, e.g. table columns. Pass `keys`, or `keysFrom` to offer every non-sensitive
   * field of a catalog source (fields missing from the base spec appear hidden by default).
   */
  collection: (
    opts: Omit<CollectionDef, "kind" | "item" | "reorder" | "hide" | "keys" | "source"> &
      Partial<Pick<CollectionDef, "item" | "reorder" | "hide" | "keys">> & {
        keysFrom?: { catalog: Catalog; source: string };
      },
  ): CollectionDef => {
    const { keysFrom, ...rest } = opts;
    const keys = [...(rest.keys ?? [])];
    const labels = { ...(rest.labels ?? {}) };
    let source: string | undefined;
    if (keysFrom) {
      const s = keysFrom.catalog.sources[keysFrom.source];
      if (!s) throw new Error(`t.collection keysFrom: unknown source "${keysFrom.source}"`);
      source = keysFrom.source;
      for (const fid of Object.keys(offerableFields(s))) {
        if (!keys.includes(fid)) keys.push(fid);
        if (!labels[fid]) labels[fid] = fieldLabel(s, fid);
      }
    }
    return {
      kind: "collection",
      reorder: false,
      hide: false,
      item: {},
      ...rest,
      keys,
      labels,
      ...(source ? { source } : {}),
    };
  },
  /**
   * A view over a catalog source, for data blocks. `shape` is "rows" (pick fields),
   * "series" (group + aggregate) or "single" (one number).
   */
  query: (
    catalog: Catalog,
    opts: { shape: QueryShape; aggregations?: AggOp[] },
    meta: TypeMeta = {},
  ): QueryDef => ({
    kind: "query",
    catalog,
    shape: opts.shape,
    aggregations: opts.aggregations ?? ["count", "sum", "avg", "min", "max"],
    ...meta,
  }),
  slot: (
    opts: Omit<SlotDef, "kind" | "reorder" | "hide" | "insert"> &
      Partial<Pick<SlotDef, "reorder" | "hide" | "insert">>,
  ): SlotDef => ({ kind: "slot", reorder: false, hide: false, insert: [], ...opts }),
};

export function isListType(def: TypeDef): def is CollectionDef | SlotDef {
  return def.kind === "collection" || def.kind === "slot";
}

/** Turns `camelCase`/`snake_case` identifiers into "Camel case". */
export function humanize(id: string): string {
  const spaced = id
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
