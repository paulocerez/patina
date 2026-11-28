/**
 * The refusal guard: a deterministic check that runs before any refusal reaches the user.
 * A refusal of something the manifest allows is a bug (the model misread the manifest), so if
 * the prompt names an allowed value of a setting the refusal is about, or a column that is only
 * hidden, Patina proposes it or asks which one was meant, listing only what is possible.
 *
 * It also builds the excerpt of the manifest sent with the one retry after a refusal.
 */
import { fieldLabel, fieldPrivacy, offerableFields } from "./catalog.js";
import { type CollectionDef, humanize, type SlotDef, type TypeDef } from "./dsl.js";
import { validate } from "./engine.js";
import { msg, type Text, tx } from "./i18n.js";
import { type Manifest, nodeLabel } from "./manifest.js";
import { identifierWords, mentions, mentionsAny, normalizeText } from "./text.js";
import type { CollectionItem, NodeId, Op, SurfaceSpec, Value } from "./types.js";
import { formatValue } from "./values.js";

/** What the guard needs to know about a refusal. */
export interface RefusalInfo {
  category: string;
  /** The text the user would see. */
  message?: string;
  detail?: { node?: string | null; wanted?: string | null } | null;
}

/** A clarifying question's option: what the user sees, and the ops it stands for. */
export interface ClarifyOption {
  label: string;
  ops: Op[];
}

export type Rescue =
  | { kind: "patch"; ops: Op[]; summary: string }
  | { kind: "clarify"; question: string; options: ClarifyOption[] };

/** Refusals the guard never overrides: they are about what the user may do, not what exists. */
const NEVER_RESCUE = new Set(["safety", "data_access", "action"]);
const MAX_OPTIONS = 6;

type SettingDef = Extract<TypeDef, { kind: "enum" | "relativeDateRange" }>;

/** Names the user might use for a text: their locale, English, and the raw key. */
function names(m: Manifest<unknown>, t: Text | undefined, key?: string): string[] {
  const out = [tx(t, m.locale), tx(t, "en"), key ? identifierWords(key) : undefined];
  return [...new Set(out.filter((x): x is string => !!x))];
}

function settingValues(def: SettingDef): Value[] {
  return def.kind === "enum"
    ? def.values
    : def.allowed.map((r) => ({ relative: r }) as unknown as Value);
}

function valueNames(m: Manifest<unknown>, def: SettingDef, v: Value): string[] {
  const raw = def.kind === "enum" ? String(v) : String((v as { relative: string }).relative);
  const out = [formatValue(def, v, m.locale), formatValue(def, v, "en"), identifierWords(raw)];
  return [...new Set(out)];
}

const same = (a: Value | undefined, b: Value | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Drops matches whose name is part of a longer match ("Woche" inside "Letzte Woche"). */
function longest<T extends { name: string }>(matches: T[]): T[] {
  return matches.filter(
    (a) => !matches.some((b) => b !== a && b.name !== a.name && mentions(b.name, a.name)),
  );
}

interface NodeRef {
  id: NodeId;
  label: string;
}

/** Nodes the text names, by label or ID. */
export function mentionedNodes(m: Manifest<unknown>, spec: SurfaceSpec, text: string): NodeRef[] {
  const out: NodeRef[] = [];
  for (const id of Object.keys(spec.nodes)) {
    const label = nodeLabel(m, spec, id);
    if (mentionsAny(text, [label === id ? undefined : label, identifierWords(id)]))
      out.push({ id, label });
  }
  return out;
}

/**
 * Checks a refusal against the manifest. Returns a proposal or a clarifying question when the
 * prompt names something that is allowed, or null when the refusal stands.
 */
export function rescueRefusal(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  prompt: string,
  refusal: RefusalInfo,
): Rescue | null {
  if (NEVER_RESCUE.has(refusal.category)) return null;
  const L = m.locale;
  const about = `${refusal.message ?? ""} ${refusal.detail?.wanted ? identifierWords(refusal.detail.wanted) : ""}`;
  const detailNode = refusal.detail?.node ?? null;

  // 1. Settings: the prompt names an allowed value of a setting it (or the refusal) is about.
  const settingHits: { op: Op; name: string; label: string }[] = [];
  for (const [id, node] of Object.entries(spec.nodes)) {
    const comp = m.components[node.component];
    if (!comp) continue;
    for (const [prop, def] of Object.entries(comp.props)) {
      if (def.kind !== "enum" && def.kind !== "relativeDateRange") continue;
      const propNames = names(m, def.label, prop);
      const relevant =
        mentionsAny(prompt, propNames) !== null ||
        mentionsAny(about, propNames) !== null ||
        detailNode === id;
      if (!relevant) continue;
      const hits: { v: Value; name: string }[] = [];
      for (const v of settingValues(def)) {
        const name = mentionsAny(prompt, valueNames(m, def, v));
        if (name) hits.push({ v, name });
      }
      for (const h of longest(hits)) {
        if (same(h.v, node.props[prop])) continue;
        const propLabel = tx(def.label, L) ?? humanize(prop);
        settingHits.push({
          op: { op: "set", node: id, path: [prop], value: h.v },
          name: h.name,
          label: `${propLabel}: ${formatValue(def, h.v, L)}`,
        });
      }
    }
  }

  // 2. Columns and sections that exist but are hidden: show them.
  const showHits: { op: Op; label: string }[] = [];
  const wanted = refusal.detail?.wanted
    ? normalizeText(identifierWords(refusal.detail.wanted))
    : "";
  for (const [id, node] of Object.entries(spec.nodes)) {
    const comp = m.components[node.component];
    if (!comp) continue;
    for (const [prop, def] of Object.entries(comp.props)) {
      if ((def.kind !== "collection" && def.kind !== "slot") || !def.hide) continue;
      const items = listItems(node.props[prop]);
      for (const item of items) {
        if (item.hidden !== true) continue;
        const label = itemLabel(m, spec, def, item.key);
        const byWanted = wanted !== "" && normalizeText(identifierWords(item.key)) === wanted;
        const named = mentionsAny(prompt, [label, identifierWords(item.key)]) !== null;
        if (!byWanted && !named) continue;
        const owner = nodeLabel(m, spec, id);
        // Only for a table the user (or the refusal) named, or the exact key the refusal says
        // is missing: "filter by summary" must not turn into "show the summary column".
        const ownerNamed =
          detailNode === id || mentionsAny(prompt, [owner, identifierWords(id)]) !== null;
        if (!byWanted && !ownerNamed) continue;
        showHits.push({
          op: { op: "set", node: id, path: [prop, item.key, "hidden"], value: false },
          label: `${owner}: ${label}`,
        });
      }
    }
  }
  const candidates = [...settingHits, ...showHits].filter(
    (c) => validate(m, spec, [c.op]).length === 0,
  );
  if (candidates.length === 1) {
    const c = candidates[0] as (typeof candidates)[number];
    return { kind: "patch", ops: [c.op], summary: c.label };
  }
  if (candidates.length > 1)
    return {
      kind: "clarify",
      question: msg(L, "guardWhichOne"),
      options: candidates.slice(0, MAX_OPTIONS).map((c) => ({ label: c.label, ops: [c.op] })),
    };
  return null;
}

function listItems(v: Value | undefined): CollectionItem[] {
  return (Array.isArray(v) ? v : []) as unknown as CollectionItem[];
}

function itemLabel(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  def: CollectionDef | SlotDef,
  key: string,
): string {
  if (def.kind === "slot") return nodeLabel(m, spec, key);
  return tx(def.labels?.[key], m.locale) ?? humanize(key);
}

/**
 * The part of the manifest a refusal is about, as short text for the retry: allowed values with
 * their labels in the user's language, collection keys, insertable presets and data fields.
 * Falls back to every setting when the prompt and refusal name nothing.
 */
export function relevantOptions(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  prompt: string,
  refusal: RefusalInfo,
  maxLines = 40,
): string {
  const L = m.locale;
  const text = `${prompt} ${refusal.message ?? ""}`;
  const named = new Set(mentionedNodes(m, spec, text).map((n) => n.id));
  if (refusal.detail?.node && spec.nodes[refusal.detail.node]) named.add(refusal.detail.node);
  const lines: string[] = [];
  const q = (s: string) => JSON.stringify(s);
  for (const [id, node] of Object.entries(spec.nodes)) {
    const comp = m.components[node.component];
    if (!comp) continue;
    for (const [prop, def] of Object.entries(comp.props)) {
      const propNamed = mentionsAny(text, names(m, def.label, prop)) !== null;
      if (named.size && !named.has(id) && !propNamed) continue;
      const where = `${q(id)} (${nodeLabel(m, spec, id)}).${prop}${def.label ? ` (${tx(def.label, L)})` : ""}`;
      if (def.kind === "enum" || def.kind === "relativeDateRange") {
        const vals = settingValues(def).map((v) => {
          const raw = def.kind === "enum" ? String(v) : JSON.stringify(v);
          return `${raw} = ${q(formatValue(def, v, L))}`;
        });
        lines.push(
          `- set ${where}: ${vals.join(", ")}; now ${JSON.stringify(node.props[prop] ?? null)}`,
        );
      } else if (def.kind === "int") {
        lines.push(`- set ${where}: whole number ${def.min}–${def.max}`);
      } else if (def.kind === "bool") {
        lines.push(`- set ${where}: true or false`);
      } else if (def.kind === "collection" || def.kind === "slot") {
        const keys = listItems(node.props[prop]).map(
          (it) =>
            `${it.key} = ${q(itemLabel(m, spec, def, it.key))}${it.hidden === true ? " (hidden)" : ""}`,
        );
        if (keys.length) lines.push(`- items of ${where}: ${keys.join(", ")}`);
        if (def.kind === "slot" && def.insert.length)
          lines.push(
            `- can add to ${where}: ${def.insert
              .filter((p) => m.presets[p])
              .map((p) => `${p} = ${q(tx(m.presets[p]?.label, L) ?? p)}`)
              .join(", ")}`,
          );
      }
    }
  }
  for (const [sid, s] of Object.entries(m.catalog?.sources ?? {})) {
    const fields = Object.entries(offerableFields(s)).map(([fid, fd]) => {
      const vals =
        fieldPrivacy(fd) === "display"
          ? " (display only)"
          : fd.values
            ? ` (values: ${fd.values.slice(0, 12).join(", ")})`
            : "";
      return `${fid} = ${q(fieldLabel(s, fid, L))}${vals}`;
    });
    if (fields.length) lines.push(`- data ${q(sid)} (${tx(s.label, L)}): ${fields.join(", ")}`);
  }
  return (lines.length > maxLines ? [...lines.slice(0, maxLines), "- …"] : lines).join("\n");
}
