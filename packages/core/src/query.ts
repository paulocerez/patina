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
  label?: string;
  description?: string;
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
export function checkQuery(def: QueryDef, value: unknown): string | null {
  if (!isObj(value)) return "must describe which data to show";
  for (const k of Object.keys(value))
    if (!KEYS[def.shape].includes(k)) return `can't use “${k}” here`;
  const sourceId = value.source;
  const source = typeof sourceId === "string" ? def.catalog.sources[sourceId] : undefined;
  if (!source) {
    const names = Object.values(def.catalog.sources).map((s) => s.label);
    return names.length ? `can only show data from ${names.join(", ")}` : "has no data available";
  }
  const fields = offerableFields(source);
  const fieldErr = (f: unknown, kinds?: Set<string>): string | null => {
    if (typeof f !== "string" || !fields[f])
      return `can't use “${String(f)}”: it isn't available to you in ${source.label}`;
    if (kinds && !kinds.has((fields[f] as FieldDef).kind))
      return `can't use ${fieldLabel(source, f)} that way`;
    return null;
  };

  if (value.where !== undefined) {
    if (!Array.isArray(value.where) || value.where.length > 3) return "can have at most 3 filters";
    for (const w of value.where) {
      if (!isObj(w) || Object.keys(w).length !== 2) return "has a malformed filter";
      const e = fieldErr(w.field, new Set(["enum", "bool"]));
      if (e) return e;
      const fd = fields[w.field as string] as FieldDef;
      if (
        fd.kind === "enum" ? !fd.values?.includes(w.value as string) : typeof w.value !== "boolean"
      )
        return `can't filter ${fieldLabel(source, w.field as string)} by “${String(w.value)}”`;
    }
  }

  if (def.shape === "rows") {
    const fs = value.fields;
    if (!Array.isArray(fs) || fs.length === 0 || fs.length > MAX_FIELDS)
      return `needs 1 to ${MAX_FIELDS} fields`;
    if (new Set(fs).size !== fs.length) return "lists a field twice";
    for (const fld of fs) {
      const e = fieldErr(fld);
      if (e) return e;
    }
    if (value.sort !== undefined) {
      if (!isObj(value.sort) || Object.keys(value.sort).length !== 2) return "has a malformed sort";
      const e = fieldErr(value.sort.field);
      if (e) return e;
      if (value.sort.dir !== "asc" && value.sort.dir !== "desc")
        return "must sort ascending or descending";
    }
    if (
      value.limit !== undefined &&
      !(
        Number.isInteger(value.limit) &&
        (value.limit as number) >= 1 &&
        (value.limit as number) <= MAX_LIMIT
      )
    )
      return `can show at most ${MAX_LIMIT} rows`;
    return null;
  }

  if (!source.complete)
    return `${source.label} can't be summarized (the app doesn't return all of it at once)`;
  const m = value.metric;
  if (!isObj(m) || typeof m.op !== "string" || !def.aggregations.includes(m.op as AggOp))
    return `must compute one of: ${def.aggregations.join(", ")}`;
  const mKeys = Object.keys(m).filter((k) => m[k] !== undefined);
  if (m.op === "count") {
    if (mKeys.length !== 1) return "counts rows, not a field";
  } else {
    if (mKeys.length !== 2) return `needs a number field to ${m.op}`;
    const e = fieldErr(m.field, NUMERIC);
    if (e) return e;
  }

  if (def.shape === "series") {
    const g = value.groupBy;
    if (!isObj(g)) return "needs something to group by";
    const e = fieldErr(g.field);
    if (e) return e;
    const kind = (fields[g.field as string] as FieldDef).kind;
    if (kind === "date") {
      if (!["day", "week", "month"].includes(g.bucket as string))
        return "must group dates by day, week or month";
      if (Object.keys(g).length !== 2) return "has a malformed grouping";
    } else {
      if (!GROUPABLE.has(kind)) return `can't group by ${fieldLabel(source, g.field as string)}`;
      if (Object.keys(g).filter((k) => g[k] !== undefined).length !== 1)
        return "only groups dates by day, week or month";
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
  const description = [def.description, describeShape(def)].filter(Boolean).join(" ");
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

const OP_LABEL: Record<AggOp, string> = {
  count: "Number of",
  sum: "Total",
  avg: "Average",
  min: "Lowest",
  max: "Highest",
};

/** "Total revenue", but "Sum of total" rather than "Total total". */
function metricLabel(op: AggOp, field: string): string {
  const word = OP_LABEL[op];
  return field.startsWith(word.toLowerCase())
    ? `${op === "sum" ? "Sum" : word} of ${field}`
    : `${word} ${field}`;
}

/** "Total Revenue by Vet", "Number of Appointments where Status is No-show", "Appointments: Date, Vet". */
export function describeQuery(catalog: Catalog, q: Query): string {
  const s = catalog.sources[q.source];
  const name = s?.label ?? q.source;
  const where = q.where?.length
    ? ` where ${q.where.map((w) => `${fieldLabel(s, w.field)} is ${typeof w.value === "string" ? (s?.fields[w.field]?.valueLabels?.[w.value] ?? w.value) : w.value ? "yes" : "no"}`).join(" and ")}`
    : "";
  if (q.fields) return `${name}: ${q.fields.map((x) => fieldLabel(s, x)).join(", ")}${where}`;
  const metric = q.metric
    ? q.metric.op === "count"
      ? `${OP_LABEL.count} ${name.toLowerCase()}`
      : metricLabel(q.metric.op, fieldLabel(s, q.metric.field ?? "").toLowerCase())
    : name;
  const by = q.groupBy
    ? ` by ${q.groupBy.bucket ? `${q.groupBy.bucket} (${fieldLabel(s, q.groupBy.field).toLowerCase()})` : fieldLabel(s, q.groupBy.field).toLowerCase()}`
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
export function runQuery(catalog: Catalog, q: Query, input: unknown): QueryResult {
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
      label: s?.label ?? q.source,
      columns: q.fields.map((field) => ({
        field,
        label: fieldLabel(s, field),
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
  const label = describeQuery(catalog, {
    source: q.source,
    metric,
    ...(q.groupBy ? { groupBy: q.groupBy } : {}),
    ...(q.where ? { where: q.where } : {}),
  });
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
      fd?.kind === "enum"
        ? (fd.valueLabels?.[key] ?? key)
        : fd?.kind === "bool"
          ? key === "true"
            ? "Yes"
            : "No"
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
