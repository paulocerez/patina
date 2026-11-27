import { type CollectionDef, humanize, type SlotDef, type TypeDef } from "./dsl.js";
import { listOr, msg, RELATIVE_RANGE_TEXT, tx } from "./i18n.js";

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
export function checkValue(def: TypeDef, value: Value, locale?: string): string | null {
  if (value === null) return null;
  const L = locale;
  switch (def.kind) {
    case "enum":
      return typeof value === "string" && def.values.includes(value)
        ? null
        : msg(L, "mustBeOneOf", {
            options: listOr(
              def.values.map((v) => tx(def.labels?.[v], L) ?? humanize(v)),
              L,
            ),
          });
    case "int":
      return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= def.min &&
        value <= def.max
        ? null
        : msg(L, "mustBeWholeNumber", { min: def.min, max: def.max });
    case "bool":
      return typeof value === "boolean" ? null : msg(L, "mustBeOnOff");
    case "label":
      if (typeof value !== "string") return msg(L, "mustBeText");
      if (value.length > def.maxLen) return msg(L, "atMostChars", { max: def.maxLen });
      if (CONTROL_CHARS.test(value)) return msg(L, "disallowedChars");
      return null;
    case "relativeDateRange": {
      const ok =
        isPlainObject(value) &&
        Object.keys(value).length === 1 &&
        typeof value.relative === "string" &&
        (def.allowed as string[]).includes(value.relative);
      return ok
        ? null
        : msg(L, "mustBeOneOf", {
            options: listOr(
              def.allowed.map((r) => rangeLabel(r, L)),
              L,
            ),
          });
    }
    case "sort": {
      const ok =
        isPlainObject(value) &&
        Object.keys(value).length === 2 &&
        typeof value.key === "string" &&
        def.keys.includes(value.key) &&
        (value.dir === "asc" || value.dir === "desc");
      return ok ? null : msg(L, "mustSortBy", { options: listOr(def.keys.map(humanize), L) });
    }
    case "query":
      return checkQuery(def, value, L);
    case "object": {
      if (!isPlainObject(value)) return msg(L, "wrongShape");
      for (const k of Object.keys(value))
        if (!(k in def.fields)) return msg(L, "unknownField", { field: k });
      for (const [k, fdef] of Object.entries(def.fields)) {
        const fv = value[k];
        if (fv === undefined) return msg(L, "missingField", { field: k });
        const err = checkValue(fdef, fv, L);
        if (err) return `${tx(fdef.label, L) ?? humanize(k)} ${err}`;
      }
      return null;
    }
    case "collection":
    case "slot":
      return msg(L, "notReplaceable");
  }
}

/** JSON Schema for a scalar type, in the subset structured outputs support. */
export function jsonSchemaFor(def: ValueTypeDef): Record<string, unknown> {
  // For the model: descriptions in English where the host provided several languages.
  const description =
    [tx(def.description, "en"), rangeHint(def)].filter(Boolean).join(" ") || undefined;
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

function rangeLabel(r: string, locale?: string): string {
  const t = RELATIVE_RANGE_TEXT[r];
  return t ? (tx(t, locale) ?? r) : r;
}

/** Human-readable rendering of a value for previews, in `locale`. */
export function formatValue(def: TypeDef | undefined, value: Value, locale?: string): string {
  const L = locale;
  if (value === null) return msg(L, "default");
  if (def?.kind === "enum" && typeof value === "string")
    return tx(def.labels?.[value], L) ?? humanize(value);
  if (def?.kind === "bool") return value ? msg(L, "on") : msg(L, "off");
  if (def?.kind === "relativeDateRange" && isPlainObject(value))
    return rangeLabel(String(value.relative), L);
  if (def?.kind === "query" && isPlainObject(value))
    return describeQuery(def.catalog, value as unknown as Query, L);
  if (def?.kind === "sort" && isPlainObject(value))
    return `${humanize(String(value.key))}, ${value.dir === "asc" ? msg(L, "ascending") : msg(L, "descending")}`;
  if (typeof value === "string") return L?.startsWith("de") ? `„${value}“` : `“${value}”`;
  return JSON.stringify(value);
}

/** @deprecated Use listOr from i18n. */
export function listOf(items: string[]): string {
  return listOr(items, "en");
}
