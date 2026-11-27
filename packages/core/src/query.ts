/**
 * Queries: declarative descriptions of a view over one catalog source. A query is plain
 * data (no code), validated against the catalog, and evaluated in the browser over rows the
 * host's endpoint already returned. Aggregation is display-only arithmetic, not business logic.
 */
import {
  type Catalog,
  type FieldDef,
  fieldLabel,
  offerableFields,
  type SourceDef,
} from "./catalog.js";
import { type MessageKey, msg, type Text, tx } from "./i18n.js";

export type AggOp = "count" | "sum" | "avg" | "min" | "max";
export type Bucket = "day" | "week" | "month";
export type QueryShape = "rows" | "series" | "single";

export interface Query {
  source: string;
  /** rows: the fields to show, in order. */
  fields?: string[];
  /** series: group by a field (dates need a bucket). */
  groupBy?: { field: string; bucket?: Bucket };
  /** series / single: what to compute. */
  metric?: { op: AggOp; field?: string };
  /** Simple equality filters on enum and bool fields. */
  where?: { field: string; value: string | boolean }[];
  /** rows: sort and limit. */
  sort?: { field: string; dir: "asc" | "desc" };
  limit?: number;
}

export interface QueryDef {
  kind: "query";
  catalog: Catalog;
  shape: QueryShape;
  aggregations: AggOp[];
  label?: Text;
  description?: Text;
}

const NUMERIC = new Set(["number", "currency"]);
const GROUPABLE = new Set(["enum", "string", "bool"]);
const KEYS: Record<QueryShape, string[]> = {
  rows: ["source", "fields", "where", "sort", "limit"],
  series: ["source", "groupBy", "metric", "where"],
  single: ["source", "metric", "where"],
};
export const MAX_FIELDS = 12;
export const MAX_LIMIT = 100;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Returns a user-readable problem with a query, or null if it is valid. */
export function checkQuery(def: QueryDef, value: unknown, locale?: string): string | null {
  const L = locale;
  if (!isObj(value)) return msg(L, "queryMustDescribe");
  for (const k of Object.keys(value))
    if (!KEYS[def.shape].includes(k)) return msg(L, "queryCantUse", { key: k });
  const sourceId = value.source;
  const source = typeof sourceId === "string" ? def.catalog.sources[sourceId] : undefined;
  if (!source) {
    const names = Object.values(def.catalog.sources).map((s) => tx(s.label, L) as string);
    return names.length
      ? msg(L, "queryOnlyFrom", { sources: names.join(", ") })
      : msg(L, "queryNoData");
  }
  const fields = offerableFields(source);
  const fieldErr = (f: unknown, kinds?: Set<string>): string | null => {
    if (typeof f !== "string" || !fields[f])
      return msg(L, "queryFieldUnavailable", {
        field: String(f),
        source: tx(source.label, L) as string,
      });
    if (kinds && !kinds.has((fields[f] as FieldDef).kind))
      return msg(L, "queryFieldWrongWay", { field: fieldLabel(source, f, L) });
    return null;
  };

  if (value.where !== undefined) {
    if (!Array.isArray(value.where) || value.where.length > 3) return msg(L, "queryMaxFilters");
    for (const w of value.where) {
      if (!isObj(w) || Object.keys(w).length !== 2) return msg(L, "queryBadFilter");
      const e = fieldErr(w.field, new Set(["enum", "bool"]));
      if (e) return e;
      const fd = fields[w.field as string] as FieldDef;
      if (
        fd.kind === "enum" ? !fd.values?.includes(w.value as string) : typeof w.value !== "boolean"
      )
        return msg(L, "queryCantFilter", {
          field: fieldLabel(source, w.field as string, L),
          value: String(w.value),
        });
    }
  }

  if (def.shape === "rows") {
    const fs = value.fields;
    if (!Array.isArray(fs) || fs.length === 0 || fs.length > MAX_FIELDS)
      return msg(L, "queryFieldCount", { max: MAX_FIELDS });
    if (new Set(fs).size !== fs.length) return msg(L, "queryFieldTwice");
    for (const fld of fs) {
      const e = fieldErr(fld);
      if (e) return e;
    }
    if (value.sort !== undefined) {
      if (!isObj(value.sort) || Object.keys(value.sort).length !== 2) return msg(L, "queryBadSort");
      const e = fieldErr(value.sort.field);
      if (e) return e;
      if (value.sort.dir !== "asc" && value.sort.dir !== "desc") return msg(L, "querySortDir");
    }
    if (
      value.limit !== undefined &&
      !(
        Number.isInteger(value.limit) &&
        (value.limit as number) >= 1 &&
        (value.limit as number) <= MAX_LIMIT
      )
    )
      return msg(L, "queryMaxRows", { max: MAX_LIMIT });
    return null;
  }

  if (!source.complete)
    return msg(L, "queryNotComplete", { source: tx(source.label, L) as string });
  const m = value.metric;
  if (!isObj(m) || typeof m.op !== "string" || !def.aggregations.includes(m.op as AggOp))
    return msg(L, "queryMetricOneOf", { ops: def.aggregations.join(", ") });
  const mKeys = Object.keys(m).filter((k) => m[k] !== undefined);
  if (m.op === "count") {
    if (mKeys.length !== 1) return msg(L, "queryCountRows");
  } else {
    if (mKeys.length !== 2) return msg(L, "queryNeedsNumber", { op: String(m.op) });
    const e = fieldErr(m.field, NUMERIC);
    if (e) return e;
  }

  if (def.shape === "series") {
    const g = value.groupBy;
    if (!isObj(g)) return msg(L, "queryNeedsGroup");
    const e = fieldErr(g.field);
    if (e) return e;
    const kind = (fields[g.field as string] as FieldDef).kind;
    if (kind === "date") {
      if (!["day", "week", "month"].includes(g.bucket as string)) return msg(L, "queryDateBucket");
      if (Object.keys(g).length !== 2) return msg(L, "queryBadGroup");
    } else {
      if (!GROUPABLE.has(kind))
        return msg(L, "queryCantGroup", { field: fieldLabel(source, g.field as string, L) });
      if (Object.keys(g).filter((k) => g[k] !== undefined).length !== 1)
        return msg(L, "queryOnlyDatesBucket");
    }
  }
  return null;
}

/** JSON Schema for a query value (structured-output subset: optional parts are nullable). */
export function querySchema(def: QueryDef): Record<string, unknown> {
  const obj = (properties: Record<string, unknown>) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });
  const variants: Record<string, unknown>[] = [];
  for (const [id, s] of Object.entries(def.catalog.sources)) {
    const fields = offerableFields(s);
    const names = Object.keys(fields);
    if (!names.length) continue;
    const of = (pred: (fd: FieldDef) => boolean) =>
      names.filter((n) => pred(fields[n] as FieldDef));
    const filterable = of((fd) => fd.kind === "enum" || fd.kind === "bool");
    const where = filterable.length
      ? nullable({
          type: "array",
          items: obj({
            field: { type: "string", enum: filterable },
            value: { anyOf: [{ type: "string" }, { type: "boolean" }] },
          }),
        })
      : { type: "null" };
    const numeric = of((fd) => NUMERIC.has(fd.kind));
    const metric = obj({
      op: { type: "string", enum: def.aggregations },
      field: numeric.length ? nullable({ type: "string", enum: numeric }) : { type: "null" },
    });
    if (def.shape === "rows") {
      variants.push(
        obj({
          source: { type: "string", const: id },
          fields: { type: "array", items: { type: "string", enum: names } },
          where,
          sort: nullable(
            obj({
              field: { type: "string", enum: names },
              dir: { type: "string", enum: ["asc", "desc"] },
            }),
          ),
          limit: nullable({ type: "integer" }),
        }),
      );
    } else if (s.complete) {
      const groupable = of((fd) => GROUPABLE.has(fd.kind) || fd.kind === "date");
      const shapeProps: Record<string, unknown> = {
        source: { type: "string", const: id },
        metric,
        where,
      };
      if (def.shape === "series") {
        if (!groupable.length) continue;
        shapeProps.groupBy = obj({
          field: { type: "string", enum: groupable },
          bucket: nullable({ type: "string", enum: ["day", "week", "month"] }),
        });
      }
      variants.push(obj(shapeProps));
    }
  }
  const description = [tx(def.description, "en"), describeShape(def)].filter(Boolean).join(" ");
  return variants.length === 1
    ? { ...(variants[0] as object), description }
    : { anyOf: variants, description };
}

function describeShape(def: QueryDef): string {
  if (def.shape === "rows") return `Rows of one data source: pick up to ${MAX_FIELDS} fields.`;
  if (def.shape === "series")
    return "One number per group: group by a field (dates by day/week/month); count rows or sum/avg/min/max a number field.";
  return "One number: count rows or sum/avg/min/max a number field, optionally filtered.";
}

/** Removes `null` optional parts (structured outputs send nulls for omitted fields). */
export function cleanQuery(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(cleanQuery);
  if (!isObj(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) out[k] = cleanQuery(x);
  return out;
}

const OP_KEY: Record<AggOp, MessageKey> = {
  count: "opCount",
  sum: "opSum",
  avg: "opAvg",
  min: "opMin",
  max: "opMax",
};
const BUCKET_KEY: Record<Bucket, MessageKey> = {
  day: "bucketDay",
  week: "bucketWeek",
  month: "bucketMonth",
};

const isGerman = (locale?: string) => !!locale?.toLowerCase().startsWith("de");
/** English lowercases labels mid-sentence ("Total revenue"); German keeps noun capitals. */
const inSentence = (label: string, locale?: string) =>
  isGerman(locale) ? label : label.toLowerCase();

/** "Total revenue", but "Sum of total" rather than "Total total". */
function metricLabel(op: AggOp, field: string, locale?: string): string {
  const word = msg(locale, OP_KEY[op]);
  return field.toLowerCase().startsWith(word.toLowerCase())
    ? `${op === "sum" ? msg(locale, "opSumOf") : word} ${field}`
    : `${word} ${field}`;
}

function valueText(
  s: SourceDef | undefined,
  field: string,
  value: string | boolean,
  locale?: string,
): string {
  if (typeof value === "boolean") return value ? msg(locale, "yes") : msg(locale, "no");
  return tx(s?.fields[field]?.valueLabels?.[value] as Text | undefined, locale) ?? value;
}

/**
 * A title for a query, in `locale`: "Total revenue by vet", "Number of appointments where
 * Status is No-show", "Appointments: Date, Vet"; German "Summe Umsatz nach Tierarzt".
 */
export function describeQuery(catalog: Catalog, q: Query, locale?: string): string {
  const L = locale;
  const s = catalog.sources[q.source];
  const name = tx(s?.label, L) ?? q.source;
  const where = q.where?.length
    ? isGerman(L)
      ? ` (${q.where.map((w) => `${fieldLabel(s, w.field, L)}: ${valueText(s, w.field, w.value, L)}`).join(", ")})`
      : ` ${msg(L, "where")} ${q.where.map((w) => `${fieldLabel(s, w.field, L)} ${msg(L, "is")} ${valueText(s, w.field, w.value, L)}`).join(` ${msg(L, "and")} `)}`
    : "";
  if (q.fields) return `${name}: ${q.fields.map((x) => fieldLabel(s, x, L)).join(", ")}${where}`;
  const metric = q.metric
    ? q.metric.op === "count"
      ? `${msg(L, "opCount")} ${inSentence(name, L)}`
      : metricLabel(q.metric.op, inSentence(fieldLabel(s, q.metric.field ?? "", L), L), L)
    : name;
  const by = q.groupBy
    ? ` ${msg(L, "by")} ${q.groupBy.bucket ? `${msg(L, BUCKET_KEY[q.groupBy.bucket])} (${inSentence(fieldLabel(s, q.groupBy.field, L), L)})` : inSentence(fieldLabel(s, q.groupBy.field, L), L)}`
    : "";
  return `${metric}${by}${where}`;
}

// ─────────────────────────────── evaluation ───────────────────────────────

export type QueryResult =
  | {
      shape: "rows";
      label: string;
      columns: { field: string; label: string; def: FieldDef }[];
      rows: Record<string, unknown>[];
    }
  | {
      shape: "series";
      label: string;
      valueDef: FieldDef | null;
      points: { key: string; label: string; value: number }[];
    }
  | { shape: "single"; label: string; valueDef: FieldDef | null; value: number };

function bucketOf(value: unknown, bucket: Bucket): string | null {
  const d = new Date(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00Z`
      : String(value),
  );
  if (Number.isNaN(d.getTime())) return null;
  if (bucket === "month") return d.toISOString().slice(0, 7);
  if (bucket === "week")
    return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function aggregate(op: AggOp, rows: Record<string, unknown>[], field?: string): number {
  if (op === "count") return rows.length;
  const nums = rows
    .map((r) => r[field ?? ""])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return 0;
  switch (op) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
  }
}

/** Evaluates a (validated) query over rows the endpoint returned. Pure and deterministic. */
export function runQuery(catalog: Catalog, q: Query, input: unknown, locale?: string): QueryResult {
  const s = catalog.sources[q.source] as SourceDef;
  let rows = (Array.isArray(input) ? input : []).filter(isObj);
  for (const w of q.where ?? []) rows = rows.filter((r) => r[w.field] === w.value);

  if (q.fields) {
    const sorted = q.sort
      ? [...rows].sort(
          (a, b) =>
            compare(a[q.sort?.field ?? ""], b[q.sort?.field ?? ""]) *
            (q.sort?.dir === "desc" ? -1 : 1),
        )
      : rows;
    const limited = sorted.slice(0, q.limit ?? MAX_LIMIT);
    return {
      shape: "rows",
      label: tx(s?.label, locale) ?? q.source,
      columns: q.fields.map((field) => ({
        field,
        label: fieldLabel(s, field, locale),
        def: s.fields[field] as FieldDef,
      })),
      rows: limited.map((r) =>
        Object.fromEntries([
          ...(s.rowKey ? [[s.rowKey, r[s.rowKey]]] : []),
          ...(q.fields ?? []).map((x) => [x, r[x]]),
        ]),
      ),
    };
  }

  const metric = q.metric ?? { op: "count" as const };
  const valueDef = metric.field ? (s.fields[metric.field] ?? null) : null;
  const label = describeQuery(
    catalog,
    {
      source: q.source,
      metric,
      ...(q.groupBy ? { groupBy: q.groupBy } : {}),
      ...(q.where ? { where: q.where } : {}),
    },
    locale,
  );
  if (!q.groupBy)
    return { shape: "single", label, valueDef, value: aggregate(metric.op, rows, metric.field) };

  const { field, bucket } = q.groupBy;
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const raw = r[field];
    const key = bucket
      ? bucketOf(raw, bucket)
      : raw === undefined || raw === null
        ? null
        : String(raw);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const fd = s.fields[field];
  const points = [...groups.entries()].map(([key, rs]) => ({
    key,
    label:
      fd?.kind === "enum" || fd?.kind === "bool"
        ? valueText(s, field, fd.kind === "bool" ? key === "true" : key, locale)
        : key,
    value: aggregate(metric.op, rs, metric.field),
  }));
  points.sort(
    bucket
      ? (a, b) => a.key.localeCompare(b.key)
      : (a, b) => b.value - a.value || a.key.localeCompare(b.key),
  );
  return { shape: "series", label, valueDef, points };
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
