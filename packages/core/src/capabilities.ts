import { offerableFields } from "./catalog.js";
import type { CollectionDef, SlotDef, TypeDef } from "./dsl.js";
import { humanize } from "./dsl.js";
import { listAnd, msg, tx } from "./i18n.js";
import { type Manifest, nodeLabel } from "./manifest.js";
import { identifierWords, mentions, mentionsAny } from "./text.js";
import type { CollectionItem, SurfaceSpec, Value } from "./types.js";
import { formatValue } from "./values.js";

/**
 * What this user can ask for on a surface, in their language: built from the restricted
 * manifest (after `restrict` and permissions) and the public catalog, never by the model.
 * Sent with every `SurfaceState` and used in refusals.
 */
export interface Capabilities {
  /** Lists that can be reordered, hidden or added to (page sections, columns, cards…). */
  arrange: ArrangeCapability[];
  /** Settings with the values they can take. */
  settings: SettingCapability[];
  /**
   * Data that can be added as new views (tables, charts, numbers). Empty without a catalog or
   * when data views are off for this user. Sensitive fields never appear.
   */
  data: DataCapability[];
}

export interface ArrangeCapability {
  node: string;
  prop: string;
  /** e.g. "Sections", "Orders table columns". */
  label: string;
  reorder: boolean;
  hide: boolean;
  /** Every item, including hidden ones (they can be shown again). */
  items: { key: string; label: string; hidden: boolean }[];
  /** What can be added here (presets), e.g. "Table", "Chart". */
  add: { preset: string; label: string }[];
}

export interface SettingCapability {
  node: string;
  prop: string;
  /** e.g. "Default date range". */
  label: string;
  /** The part of the page it belongs to, e.g. "Dashboard". */
  nodeLabel: string;
  kind: TypeDef["kind"];
  /** The values it can take, for enums, on/off, date ranges and sorts. */
  values?: { value: Value; label: string }[];
  /** For numbers. */
  min?: number;
  max?: number;
  current?: Value;
}

export interface DataCapability {
  source: string;
  label: string;
  fields: { field: string; label: string }[];
  /** True if counts, totals and averages can be shown (the source returns all rows). */
  aggregates: boolean;
}

const MAX_LISTED = 6;

/** A node's name for users: its label, or a readable form of its ID. */
function itemName(m: Manifest<unknown>, spec: SurfaceSpec, id: string): string {
  const label = nodeLabel(m, spec, id);
  return label === id ? humanize(id) : label;
}

function propLabel(def: TypeDef | CollectionDef | SlotDef, prop: string, locale?: string): string {
  return tx(def.label, locale) ?? humanize(prop);
}

function settingValues(def: TypeDef, locale?: string): SettingCapability["values"] {
  switch (def.kind) {
    case "enum":
      return def.values.map((v) => ({ value: v, label: formatValue(def, v, locale) }));
    case "bool":
      return [true, false].map((v) => ({ value: v, label: formatValue(def, v, locale) }));
    case "relativeDateRange":
      return def.allowed.map((r) => {
        const value = { relative: r } as unknown as Value;
        return { value, label: formatValue(def, value, locale) };
      });
    case "sort":
      return def.keys.map((k) => ({ value: k, label: humanize(k) }));
    default:
      return undefined;
  }
}

/**
 * The capabilities for one user: pass the manifest after `restrictManifest` /
 * `localizeManifest` (and `withoutDataViews` when data views are off) and the spec they see.
 */
export function capabilities(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  options: { dataViews?: boolean } = {},
): Capabilities {
  const L = m.locale;
  const arrange: ArrangeCapability[] = [];
  const settings: SettingCapability[] = [];
  for (const [id, node] of Object.entries(spec.nodes)) {
    const comp = m.components[node.component];
    if (!comp) continue;
    const owner = itemName(m, spec, id);
    for (const [prop, def] of Object.entries(comp.props)) {
      if (def.kind === "slot" || def.kind === "collection") {
        const current = (Array.isArray(node.props[prop])
          ? node.props[prop]
          : []) as unknown as CollectionItem[];
        const items =
          def.kind === "slot"
            ? current.map((it) => ({
                key: it.key,
                label: itemName(m, spec, it.key),
                hidden: it.hidden === true,
              }))
            : def.keys.map((key) => ({
                key,
                label: tx(def.labels?.[key], L) ?? humanize(key),
                hidden:
                  current.find((it) => it.key === key)?.hidden === true ||
                  !current.some((it) => it.key === key),
              }));
        const add =
          def.kind === "slot"
            ? def.insert
                .filter((p) => m.presets[p])
                .map((preset) => ({
                  preset,
                  label: tx(m.presets[preset]?.label, L) ?? humanize(preset),
                }))
            : [];
        if (!def.reorder && !def.hide && add.length === 0) continue;
        const own = tx(def.label, L);
        arrange.push({
          node: id,
          prop,
          label: own ?? (def.kind === "slot" ? owner : `${owner}: ${humanize(prop)}`),
          reorder: def.reorder,
          hide: def.hide,
          items,
          add,
        });
        continue;
      }
      if (def.kind === "query" || def.kind === "object" || def.kind === "label") continue;
      const values = settingValues(def, L);
      settings.push({
        node: id,
        prop,
        label: propLabel(def, prop, L),
        nodeLabel: owner,
        kind: def.kind,
        ...(values ? { values } : {}),
        ...(def.kind === "int" ? { min: def.min, max: def.max } : {}),
        ...(node.props[prop] !== undefined ? { current: node.props[prop] } : {}),
      });
    }
  }

  const data: DataCapability[] =
    options.dataViews === false || !m.catalog
      ? []
      : Object.entries(m.catalog.sources)
          .map(([source, s]) => ({
            source,
            label: tx(s.label, L) ?? humanize(source),
            fields: Object.entries(offerableFields(s)).map(([field, fd]) => ({
              field,
              label: tx(fd.label, L) ?? humanize(field),
            })),
            aggregates: s.complete === true,
          }))
          .filter((d) => d.fields.length > 0);
  // Only offer data if a block can actually be inserted somewhere.
  const canInsertData = arrange.some((a) => a.add.length > 0);
  return { arrange, settings, data: canInsertData ? data : [] };
}

function some(labels: string[]): string {
  return labels.length > MAX_LISTED
    ? `${labels.slice(0, MAX_LISTED).join(", ")}, …`
    : labels.join(", ");
}

/**
 * One readable line per capability, in the manifest's locale ("Sections (…): reorder, hide").
 * Long lists are shortened unless `all` is set.
 */
export function capabilityLines(
  caps: Capabilities,
  locale?: string,
  options: { all?: boolean } = {},
): string[] {
  const L = locale;
  const list = (labels: string[]): string => (options.all ? labels.join(", ") : some(labels));
  const lines: string[] = [];
  for (const a of caps.arrange) {
    const verbs = [
      ...(a.reorder ? [msg(L, "capReorder")] : []),
      ...(a.hide ? [msg(L, "capHide")] : []),
    ];
    if (verbs.length)
      lines.push(
        msg(L, "capArrange", {
          what: a.label,
          items: list(a.items.map((i) => i.label)),
          verbs: listAnd(verbs, L),
        }),
      );
    if (a.add.length)
      lines.push(msg(L, "capAdd", { what: a.label, items: list(a.add.map((p) => p.label)) }));
  }
  for (const s of caps.settings)
    lines.push(
      msg(L, "capSet", {
        what: s.nodeLabel && s.nodeLabel !== s.label ? `${s.label} (${s.nodeLabel})` : s.label,
        values: s.values?.length
          ? list(s.values.map((v) => v.label))
          : s.min !== undefined
            ? `${s.min}–${s.max}`
            : "",
      }),
    );
  for (const d of caps.data)
    lines.push(msg(L, "capData", { what: d.label, fields: list(d.fields.map((f) => f.label)) }));
  return lines;
}

/**
 * A short sentence for refusals: what this user *can* ask for instead. With data to offer it
 * names the data sources; otherwise the parts of the page that can change. Empty if nothing can.
 */
export function capabilityHint(
  caps: Capabilities,
  locale?: string,
  focus: "data" | "page" = "page",
): string {
  const L = locale;
  if (focus === "data" && caps.data.length)
    return msg(L, "capHintData", {
      sources: listAnd(
        caps.data.map((d) => `${d.label} (${some(d.fields.map((f) => f.label))})`),
        L,
      ),
    });
  const parts: string[] = [];
  for (const a of caps.arrange.slice(0, 2))
    if (a.reorder || a.hide) parts.push(msg(L, "capHintArrange", { what: a.label }));
  for (const s of caps.settings.slice(0, 1))
    parts.push(
      msg(L, "capHintSet", {
        what: s.label,
        values: s.values?.length ? ` (${some(s.values.map((v) => v.label))})` : "",
      }),
    );
  if (caps.data.length)
    parts.push(
      msg(L, "capHintAddData", {
        sources: listAnd(
          caps.data.map((d) => d.label),
          L,
        ),
      }),
    );
  return parts.length ? msg(L, "capHintPage", { parts: listAnd(parts, L) }) : "";
}

/** A few example prompts for this surface, e.g. for chips in the prompt box. */
export function capabilityExamples(caps: Capabilities, locale?: string, max = 4): string[] {
  const L = locale;
  const data: string[] = [];
  const arrange: string[] = [];
  const set: string[] = [];
  for (const d of caps.data) {
    const field = d.fields[0];
    if (field)
      data.push(
        d.aggregates
          ? msg(L, "exChart", { what: d.label, field: field.label })
          : msg(L, "exTable", { what: d.label }),
      );
  }
  for (const a of caps.arrange) {
    const visible = a.items.filter((i) => !i.hidden);
    const last = visible[visible.length - 1];
    if (a.reorder && last && visible.length > 1)
      arrange.push(msg(L, "exMoveTop", { item: last.label }));
    const first = visible[0];
    if (a.hide && first && visible.length > 1)
      arrange.push(msg(L, "exHide", { item: first.label }));
  }
  for (const s of caps.settings) {
    const v = s.values?.find((x) => JSON.stringify(x.value) !== JSON.stringify(s.current));
    if (v) set.push(msg(L, "exSet", { what: s.label, value: v.label }));
  }
  // One of each kind before repeating a kind.
  const out: string[] = [];
  for (let i = 0; out.length < max && i < Math.max(data.length, arrange.length, set.length); i++)
    for (const list of [data, arrange, set]) {
      const x = list[i];
      if (x && !out.includes(x) && out.length < max) out.push(x);
    }
  return out;
}

// Questions about what is possible, not requests to change something. They must start like a
// question ("Was kann ich…", "Which columns…"): "Zeige, welche Anrufe es gibt" is a request.
// Yes/no questions that name a change ("Kann ich die Heatmap entfernen?") go to the model.
const LEAD = String.raw`^(?:(?:und|also|ok|okay|hallo|hi|hey|and|so)[\s,]+)*`;
const CAPABILITY_QUESTIONS = [
  new RegExp(
    `${LEAD}(?:was|welche[snmr]?)\\b.*\\b(?:kann|koennen|können|koennte|könnte|koennten|könnten|darf|duerfen|dürfen|laesst|lässt|gibt|geht|moeglich|möglich)\\b`,
  ),
  new RegExp(`${LEAD}(?:what|which)\\b.*\\b(?:can|could|may)\\s+(?:i|we|you|be)\\b`),
  new RegExp(
    `${LEAD}(?:what|which)\\s+(?:else|options|settings|columns|fields|data|charts|views)\\b`,
  ),
  new RegExp(
    `${LEAD}(?:is|are)\\s+there\\s+(?:any\\s+)?(?:other\\s+)?(?:options|settings|columns|fields)\\b`,
  ),
  new RegExp(`${LEAD}how\\s+(?:can|do)\\s+i\\s+customi[sz]e\\b`),
];

/**
 * Whether a prompt asks what is possible ("Was kann ich bei den letzten Anrufen anzeigen?",
 * "Which columns can I add?") rather than asking for a change. Deterministic; see
 * `answerCapabilities` for the answer.
 */
export function isCapabilityQuestion(prompt: string): boolean {
  const p = prompt.toLowerCase().replace(/\s+/g, " ").trim();
  if (!p) return false;
  return CAPABILITY_QUESTIONS.some((re) => re.test(p));
}

/**
 * Narrows capabilities to the parts of the page a prompt names (by label or ID). Data is
 * narrowed to the source behind a named table's columns, if it has one. Returns everything
 * when nothing is named.
 */
export function scopeCapabilities(
  caps: Capabilities,
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  text: string,
): { caps: Capabilities; scope: string[] } {
  const named = new Set<string>();
  for (const id of Object.keys(spec.nodes)) {
    const label = nodeLabel(m, spec, id);
    if (mentionsAny(text, [label === id ? undefined : label, identifierWords(id)])) named.add(id);
  }
  for (const a of caps.arrange) if (mentions(text, a.label)) named.add(a.node);
  for (const s of caps.settings) if (mentions(text, s.label)) named.add(s.node);
  if (named.size === 0) return { caps, scope: [] };
  const sources = new Set<string>();
  for (const id of named) {
    const node = spec.nodes[id];
    const comp = node && m.components[node.component];
    for (const [prop, def] of Object.entries(comp?.props ?? {})) {
      if (def.kind === "collection" && def.source) sources.add(def.source);
      const q = node?.props[prop] as { source?: unknown } | undefined;
      if (def.kind === "query" && typeof q?.source === "string") sources.add(q.source);
    }
  }
  const scoped: Capabilities = {
    arrange: caps.arrange.filter((a) => named.has(a.node)),
    settings: caps.settings.filter((s) => named.has(s.node)),
    // The data behind the named table, or else the data the prompt names ("…bei den Anrufen").
    data: sources.size
      ? caps.data.filter((d) => sources.has(d.source))
      : caps.data.filter((d) => mentions(text, d.label)),
  };
  if (!scoped.arrange.length && !scoped.settings.length) return { caps, scope: [] };
  return { caps: scoped, scope: [...named].map((id) => itemName(m, spec, id)) };
}

/** The text of an answer to a capability question, in the manifest's locale. */
export function answerText(caps: Capabilities, scope: string[], locale?: string): string {
  const L = locale;
  const lines = [
    ...capabilityLines({ ...caps, data: [] }, L, { all: true }),
    ...caps.data.map((d) =>
      msg(L, "answerDataFields", {
        what: d.label,
        fields: d.fields.map((f) => f.label).join(", "),
      }),
    ),
  ];
  if (!lines.length) return msg(L, "answerNothing");
  const lead = scope.length
    ? msg(L, "answerLeadFor", { what: listAnd(scope, L) })
    : msg(L, "answerLead");
  return [lead, ...lines.map((l) => `- ${l}`)].join("\n");
}
