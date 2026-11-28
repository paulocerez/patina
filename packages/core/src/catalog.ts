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

/**
 * A field computed in the browser from another field of the same row, so users can group and
 * filter by things the endpoint doesn't return as such ("calls by weekday", "short vs. long",
 * "emergencies"). Declarative: Patina evaluates it, the host writes no code.
 */
export type Derive =
  /** Day of the week of a date field: "mon" … "sun". */
  | { op: "weekday"; from: string; timeZone?: string }
  /** Hour of a date field: "00" … "23". */
  | { op: "hour"; from: string; timeZone?: string }
  /**
   * Which range a number falls in. Ranges are tried in order; a value below `below` gets that
   * range's `value`. The last range has no `below` and takes everything else.
   */
  | { op: "ranges"; from: string; ranges: { value: string; below?: number }[] }
  /** Whether a text field contains any of these words (case-insensitive). */
  | { op: "contains"; from: string; any: string[] };

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
  /**
   * Never offered to the model and never usable in new views. Same as `privacy: "never"`.
   * Use it only for values users can't already see in your app.
   */
  sensitive?: boolean;
  /**
   * How far the field may be used. Default: everywhere (shown, filtered, grouped, aggregated).
   * - "display": may be shown as a column in table/list views and listed in capabilities, but
   *   never used to filter, group, sort or aggregate, and its values never reach the model
   *   (it sees only the field's name, label and kind). Pick this when users already see the
   *   value elsewhere in the app (e.g. a call summary on every call row).
   * - "never": same as `sensitive: true`.
   * `requires` applies at every level.
   */
  privacy?: "display" | "never";
  /** Computed from another field of the row instead of read from it (see `Derive`). */
  derive?: Derive;
}

export interface ParamBinding {
  /** Take the value from a prop of the current spec: "nodeId.prop" (e.g. "filters.dateRange"). */
  from?: string;
  /** Or a fixed value. */
  value?: string | number | boolean;
  /**
   * Values a single view may pick instead (its query's `params`), e.g. a chart of "this week"
   * on a page that defaults to the last 30 days. Your `fetchSource` receives the value.
   */
  choices?: string[];
  /** Human names for `choices`. */
  choiceLabels?: Record<string, Text>;
  /** What the param is, e.g. "Date range". */
  label?: Text;
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
  /** Day of the week of the date field `from`, in `timeZone` (default: the browser's). */
  weekday: (from: string, o: FieldOpts & { timeZone?: string } = {}): FieldDef => {
    const { timeZone, ...rest } = o;
    return {
      kind: "enum",
      values: [...WEEKDAYS],
      valueLabels: WEEKDAY_LABELS,
      ...rest,
      derive: { op: "weekday", from, ...(timeZone ? { timeZone } : {}) },
    };
  },
  /** Hour of the date field `from`, "00" … "23", in `timeZone` (default: the browser's). */
  hour: (from: string, o: FieldOpts & { timeZone?: string } = {}): FieldDef => {
    const { timeZone, ...rest } = o;
    return {
      kind: "enum",
      values: HOURS,
      valueLabels: Object.fromEntries(HOURS.map((h) => [h, `${h}:00`])),
      ...rest,
      derive: { op: "hour", from, ...(timeZone ? { timeZone } : {}) },
    };
  },
  /** Groups the number field `from` into named ranges: `[{ value: "short", below: 30 }, { value: "long" }]`. */
  ranges: (
    from: string,
    ranges: { value: string; below?: number }[],
    o: FieldOpts = {},
  ): FieldDef => ({
    kind: "enum",
    values: ranges.map((r) => r.value),
    ...o,
    derive: { op: "ranges", from, ranges },
  }),
  /** True when the text field `from` contains any of `any` (case-insensitive). */
  contains: (from: string, any: string[], o: FieldOpts = {}): FieldDef => ({
    kind: "bool",
    ...o,
    derive: { op: "contains", from, any },
  }),
};

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_LABELS: Record<string, Text> = {
  mon: { en: "Monday", de: "Montag" },
  tue: { en: "Tuesday", de: "Dienstag" },
  wed: { en: "Wednesday", de: "Mittwoch" },
  thu: { en: "Thursday", de: "Donnerstag" },
  fri: { en: "Friday", de: "Freitag" },
  sat: { en: "Saturday", de: "Samstag" },
  sun: { en: "Sunday", de: "Sonntag" },
};
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

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
      if (fd.derive) problems.push(...deriveProblems(id, fid, fd.derive, s.fields));
    }
    for (const [pid, p] of Object.entries(s.params ?? {})) {
      if ((p.from === undefined) === (p.value === undefined))
        problems.push(`source "${id}" param "${pid}": set exactly one of "from" or "value"`);
      if (p.from !== undefined && !/^[^.]+\.[^.]+$/.test(p.from))
        problems.push(`source "${id}" param "${pid}": "from" must look like "nodeId.prop"`);
      if (
        p.choices !== undefined &&
        (!p.choices.length ||
          new Set(p.choices).size !== p.choices.length ||
          p.choices.some((c) => typeof c !== "string" || !c))
      )
        problems.push(`source "${id}" param "${pid}": choices must be unique, non-empty strings`);
    }
  }
  if (problems.length) throw new Error(`defineCatalog is invalid:\n  - ${problems.join("\n  - ")}`);
  return { sources };
}

function deriveProblems(
  id: string,
  fid: string,
  d: Derive,
  fields: Record<string, FieldDef>,
): string[] {
  const at = `source "${id}" field "${fid}"`;
  const from = fields[d.from];
  if (!from) return [`${at}: derives from "${d.from}", which isn't a field of "${id}"`];
  if (from.derive) return [`${at}: can't derive from another derived field ("${d.from}")`];
  // A derived value is offered to the model and shown in views: it would leak what it reads.
  if (fieldPrivacy(from) === "never")
    return [`${at}: can't derive from the sensitive field "${d.from}"`];
  // Derived values can be grouped and filtered: that would reveal a display-only field's values.
  if (fieldPrivacy(from) === "display")
    return [`${at}: can't derive from the display-only field "${d.from}"`];
  const need: Record<Derive["op"], FieldKind[]> = {
    weekday: ["date"],
    hour: ["date"],
    ranges: ["number", "currency"],
    contains: ["string", "enum"],
  };
  if (!need[d.op].includes(from.kind))
    return [
      `${at}: "${d.op}" needs a ${need[d.op].join(" or ")} field, "${d.from}" is ${from.kind}`,
    ];
  if (d.op === "ranges") {
    const r = d.ranges ?? [];
    const last = r[r.length - 1];
    const bounds = r.slice(0, -1).map((x) => x.below);
    if (r.length < 2 || !last || last.below !== undefined)
      return [`${at}: ranges need at least two entries, the last without "below"`];
    if (bounds.some((b, i) => typeof b !== "number" || (i > 0 && b <= (bounds[i - 1] as number))))
      return [`${at}: every range but the last needs a "below" larger than the one before`];
    if (new Set(r.map((x) => x.value)).size !== r.length)
      return [`${at}: range values must be unique`];
  }
  if (d.op === "contains" && !(d.any ?? []).some((w) => typeof w === "string" && w.trim()))
    return [`${at}: "contains" needs at least one word`];
  return [];
}

/** Removes sources and fields the user lacks permission for, plus explicit removals. */
export function restrictCatalog(
  c: Catalog,
  r: {
    permissions?: string[];
    sources?: string[];
    fields?: string[];
    keys?: string[];
    values?: Record<string, string[]>;
  },
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
    for (const [fid, fd] of Object.entries(fields)) {
      const values = r.values?.[`${id}.${fid}`];
      if (fd.kind === "string" && !fd.derive && values?.length)
        fields[fid] = { ...fd, kind: "enum", values: [...new Set(values)] };
    }
    sources[id] = { ...s, fields };
  }
  return { sources };
}

/** A field's privacy level: "full" (default), "display" or "never" (`sensitive: true`). */
export function fieldPrivacy(fd: FieldDef): "full" | "display" | "never" {
  if (fd.sensitive || fd.privacy === "never") return "never";
  return fd.privacy === "display" ? "display" : "full";
}

/**
 * Fields that may appear in new views and capabilities: everything except `sensitive` /
 * `privacy: "never"`. Includes display-only fields (columns only); see `queryableFields`.
 */
export function offerableFields(s: SourceDef): Record<string, FieldDef> {
  return Object.fromEntries(
    Object.entries(s.fields).filter(([, fd]) => fieldPrivacy(fd) !== "never"),
  );
}

/** Fields that may be filtered, grouped, sorted and aggregated on: no display-only fields. */
export function queryableFields(s: SourceDef): Record<string, FieldDef> {
  return Object.fromEntries(
    Object.entries(s.fields).filter(([, fd]) => fieldPrivacy(fd) === "full"),
  );
}

/**
 * What the browser needs to fetch and format block data. No sensitive fields, no descriptions.
 * Display-only fields keep `privacy: "display"` so the browser can tell them apart.
 */
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
    const params = rest.params
      ? Object.fromEntries(
          Object.entries(rest.params).map(([pid, p]) => [
            pid,
            {
              ...p,
              ...(p.label !== undefined ? { label: tx(p.label, locale) as string } : {}),
              ...(p.choiceLabels
                ? {
                    choiceLabels: Object.fromEntries(
                      Object.entries(p.choiceLabels).map(([k, v]) => [k, tx(v, locale) as string]),
                    ),
                  }
                : {}),
            },
          ]),
        )
      : undefined;
    sources[id] = {
      ...rest,
      ...(params ? { params } : {}),
      label: tx(rest.label, locale) as string,
      fields,
    };
  }
  return { sources };
}

/** Params of a source that a single view may set (those with `choices`). */
export function choiceParams(
  s: SourceDef | undefined,
): Record<string, ParamBinding & { choices: string[] }> {
  return Object.fromEntries(
    Object.entries(s?.params ?? {}).filter(
      (e): e is [string, ParamBinding & { choices: string[] }] => !!e[1].choices?.length,
    ),
  );
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
