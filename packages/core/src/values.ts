import {
  type CollectionDef,
  humanize,
  RELATIVE_RANGE_LABELS,
  type SlotDef,
  type TypeDef,
} from "./dsl.js";

type ValueTypeDef = Exclude<TypeDef, CollectionDef | SlotDef>;

import { checkQuery, describeQuery, type Query, querySchema } from "./query.js";
import type { Value } from "./types.js";

/** Control characters and bidi overrides, which have no place in a short label. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

function isPlainObject(v: Value | undefined): v is { [k: string]: Value } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Checks a value against a scalar type. Returns a user-readable reason, or null if valid.
 * `null` is always accepted: it means "back to the host's default".
 */
export function checkValue(def: TypeDef, value: Value): string | null {
  if (value === null) return null;
  switch (def.kind) {
    case "enum":
      return typeof value === "string" && def.values.includes(value)
        ? null
        : `must be one of ${listOf(def.values.map((v) => def.labels?.[v] ?? humanize(v)))}`;
    case "int":
      return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= def.min &&
        value <= def.max
        ? null
        : `must be a whole number from ${def.min} to ${def.max}`;
    case "bool":
      return typeof value === "boolean" ? null : "must be on or off";
    case "label":
      if (typeof value !== "string") return "must be text";
      if (value.length > def.maxLen) return `must be at most ${def.maxLen} characters`;
      if (CONTROL_CHARS.test(value)) return "contains characters that aren't allowed";
      return null;
    case "relativeDateRange": {
      const ok =
        isPlainObject(value) &&
        Object.keys(value).length === 1 &&
        typeof value.relative === "string" &&
        (def.allowed as string[]).includes(value.relative);
      return ok
        ? null
        : `must be one of ${listOf(def.allowed.map((r) => RELATIVE_RANGE_LABELS[r]))}`;
    }
    case "sort": {
      const ok =
        isPlainObject(value) &&
        Object.keys(value).length === 2 &&
        typeof value.key === "string" &&
        def.keys.includes(value.key) &&
        (value.dir === "asc" || value.dir === "desc");
      return ok
        ? null
        : `must sort by one of ${listOf(def.keys.map(humanize))}, ascending or descending`;
    }
    case "query":
      return checkQuery(def, value);
    case "object": {
      if (!isPlainObject(value)) return "has the wrong shape";
      for (const k of Object.keys(value))
        if (!(k in def.fields)) return `has an unknown field "${k}"`;
      for (const [k, fdef] of Object.entries(def.fields)) {
        const fv = value[k];
        if (fv === undefined) return `is missing "${k}"`;
        const err = checkValue(fdef, fv);
        if (err) return `${humanize(k)} ${err}`;
      }
      return null;
    }
    case "collection":
    case "slot":
      return "cannot be replaced as a whole; change its items instead";
  }
}

/** JSON Schema for a scalar type, in the subset structured outputs support. */
export function jsonSchemaFor(def: ValueTypeDef): Record<string, unknown> {
  const description = [def.description, rangeHint(def)].filter(Boolean).join(" ") || undefined;
  const withDesc = (s: Record<string, unknown>) => (description ? { ...s, description } : s);
  switch (def.kind) {
    case "enum":
      return withDesc({ type: "string", enum: def.values });
    case "int":
      return withDesc({ type: "integer" });
    case "bool":
      return withDesc({ type: "boolean" });
    case "label":
      return withDesc({ type: "string" });
    case "relativeDateRange":
      return withDesc({
        type: "object",
        properties: { relative: { type: "string", enum: def.allowed } },
        required: ["relative"],
        additionalProperties: false,
      });
    case "sort":
      return withDesc({
        type: "object",
        properties: {
          key: { type: "string", enum: def.keys },
          dir: { type: "string", enum: ["asc", "desc"] },
        },
        required: ["key", "dir"],
        additionalProperties: false,
      });
    case "query":
      return querySchema(def);
    case "object":
      return withDesc({
        type: "object",
        properties: Object.fromEntries(
          Object.entries(def.fields).map(([k, f]) => [k, jsonSchemaFor(f)]),
        ),
        required: Object.keys(def.fields),
        additionalProperties: false,
      });
  }
}

function rangeHint(def: ValueTypeDef): string | undefined {
  if (def.kind === "int") return `Whole number from ${def.min} to ${def.max}.`;
  if (def.kind === "label") return `Plain text, at most ${def.maxLen} characters.`;
  return undefined;
}

/** Human-readable rendering of a value for previews. */
export function formatValue(def: TypeDef | undefined, value: Value): string {
  if (value === null) return "the default";
  if (def?.kind === "enum" && typeof value === "string")
    return def.labels?.[value] ?? humanize(value);
  if (def?.kind === "bool") return value ? "on" : "off";
  if (def?.kind === "relativeDateRange" && isPlainObject(value))
    return (
      RELATIVE_RANGE_LABELS[value.relative as keyof typeof RELATIVE_RANGE_LABELS] ??
      String(value.relative)
    );
  if (def?.kind === "query" && isPlainObject(value))
    return describeQuery(def.catalog, value as unknown as Query);
  if (def?.kind === "sort" && isPlainObject(value))
    return `${humanize(String(value.key))}, ${value.dir === "asc" ? "ascending" : "descending"}`;
  if (typeof value === "string") return `“${value}”`;
  return JSON.stringify(value);
}

export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
