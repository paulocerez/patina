import { type Text, tx } from "./i18n.js";
/**
 * The data catalog: read-only data sources the host already exposes, which users may compose
 * into new views. Generated as a draft by `patina scan`, reviewed and committed by developers.
 *
 * The catalog is an allowlist. Patina never adds endpoints or queries: blocks fetch these
 * GET endpoints from the browser with the user's own session, so the host's API stays the
 * authority over what each user can see.
 */

export type FieldKind = "string" | "number" | "currency" | "date" | "enum" | "bool";

export interface FieldDef {
  kind: FieldKind;
  label?: Text;
  description?: Text;
  /** For enums. */
  values?: string[];
  /** Human names for enum values. */
  valueLabels?: Record<string, Text>;
  /** ISO 4217 code, for currency fields. */
  currency?: string;
  /** Permission the user needs (checked against `ctx.permissions`) to be offered this field. */
  requires?: string;
  /** Never offered to the model and never usable in new views. */
  sensitive?: boolean;
}

export interface ParamBinding {
  /** Take the value from a prop of the current spec: "nodeId.prop" (e.g. "filters.dateRange"). */
  from?: string;
  /** Or a fixed value. */
  value?: string | number | boolean;
}

export interface SourceDef {
  label: Text;
  description?: Text;
  /** Only GET. The path is relative to the app's origin; the model never sees it. */
  endpoint: { path: string; method: "GET" };
  params?: Record<string, ParamBinding>;
  fields: Record<string, FieldDef>;
  rowKey?: string;
  /**
   * True if the endpoint returns *all* matching rows (not one page). Required before Patina
   * offers aggregations (count, sum, …) over it, so totals are never silently wrong.
   */
  complete?: boolean;
  /** Permission the user needs to be offered this source at all. */
  requires?: string;
}

export interface Catalog {
  sources: Record<string, SourceDef>;
}

type FieldOpts = Omit<FieldDef, "kind" | "values" | "currency">;

export const f = {
  string: (o: FieldOpts = {}): FieldDef => ({ kind: "string", ...o }),
  number: (o: FieldOpts = {}): FieldDef => ({ kind: "number", ...o }),
  currency: (currency: string, o: FieldOpts = {}): FieldDef => ({
    kind: "currency",
    currency,
    ...o,
  }),
  date: (o: FieldOpts = {}): FieldDef => ({ kind: "date", ...o }),
  enum: (values: string[], o: FieldOpts = {}): FieldDef => ({ kind: "enum", values, ...o }),
  bool: (o: FieldOpts = {}): FieldDef => ({ kind: "bool", ...o }),
};

const ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** Declares the catalog. Throws at startup on anything unsafe or malformed. */
export function defineCatalog(sources: Record<string, SourceDef>): Catalog {
  const problems: string[] = [];
  for (const [id, s] of Object.entries(sources)) {
    if (!ID.test(id)) problems.push(`source id "${id}" must be a simple identifier`);
    if (s.endpoint?.method !== "GET")
      problems.push(`source "${id}": only GET endpoints are allowed`);
    const path = s.endpoint?.path ?? "";
    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("://") ||
      path.includes("..")
    )
      problems.push(`source "${id}": endpoint path must be a same-origin path like "/api/orders"`);
    if (Object.keys(s.fields ?? {}).length === 0) problems.push(`source "${id}" has no fields`);
    for (const [fid, fd] of Object.entries(s.fields ?? {})) {
      if (!ID.test(fid))
        problems.push(`source "${id}": field id "${fid}" must be a simple identifier`);
      if (fd.kind === "enum" && !fd.values?.length)
        problems.push(`source "${id}" field "${fid}": enum needs values`);
    }
    for (const [pid, p] of Object.entries(s.params ?? {})) {
      if ((p.from === undefined) === (p.value === undefined))
        problems.push(`source "${id}" param "${pid}": set exactly one of "from" or "value"`);
      if (p.from !== undefined && !/^[^.]+\.[^.]+$/.test(p.from))
        problems.push(`source "${id}" param "${pid}": "from" must look like "nodeId.prop"`);
    }
  }
  if (problems.length) throw new Error(`defineCatalog is invalid:\n  - ${problems.join("\n  - ")}`);
  return { sources };
}

/** Removes sources and fields the user lacks permission for, plus explicit removals. */
export function restrictCatalog(
  c: Catalog,
  r: { permissions?: string[]; sources?: string[]; fields?: string[]; keys?: string[] },
): Catalog {
  const perms = new Set(r.permissions ?? []);
  const dropSources = new Set(r.sources ?? []);
  const dropFields = new Set(r.fields ?? []);
  const dropKeys = new Set(r.keys ?? []);
  const sources: Record<string, SourceDef> = {};
  for (const [id, s] of Object.entries(c.sources)) {
    if (dropSources.has(id) || (s.requires && !perms.has(s.requires))) continue;
    const fields = Object.fromEntries(
      Object.entries(s.fields).filter(
        ([fid, fd]) =>
          !(fd.requires && !perms.has(fd.requires)) &&
          !dropFields.has(`${id}.${fid}`) &&
          !dropKeys.has(fid),
      ),
    );
    sources[id] = { ...s, fields };
  }
  return { sources };
}

/** Fields that may be offered to the model and used in new views. */
export function offerableFields(s: SourceDef): Record<string, FieldDef> {
  return Object.fromEntries(Object.entries(s.fields).filter(([, fd]) => !fd.sensitive));
}

/** What the browser needs to fetch and format block data. No sensitive fields, no descriptions. */
export type PublicCatalog = Catalog;

/** The catalog for the browser, with labels resolved to `locale`. */
export function publicCatalog(c: Catalog, locale?: string): PublicCatalog {
  const sources: Record<string, SourceDef> = {};
  for (const [id, s] of Object.entries(c.sources)) {
    const { description: _d, requires: _r, ...rest } = s;
    const fields = Object.fromEntries(
      Object.entries(offerableFields(s)).map(
        ([fid, { description: _fd, requires: _fr, ...fd }]) => [
          fid,
          {
            ...fd,
            ...(fd.label !== undefined ? { label: tx(fd.label, locale) as string } : {}),
            ...(fd.valueLabels
              ? {
                  valueLabels: Object.fromEntries(
                    Object.entries(fd.valueLabels).map(([k, v]) => [k, tx(v, locale) as string]),
                  ),
                }
              : {}),
          },
        ],
      ),
    );
    sources[id] = { ...rest, label: tx(rest.label, locale) as string, fields };
  }
  return { sources };
}

export function fieldLabel(s: SourceDef | undefined, field: string, locale?: string): string {
  const fd = s?.fields[field];
  const label = tx(fd?.label, locale);
  if (label) return label;
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
