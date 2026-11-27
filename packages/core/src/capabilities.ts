import { offerableFields } from "./catalog.js";
import type { CollectionDef, SlotDef, TypeDef } from "./dsl.js";
import { humanize } from "./dsl.js";
import { listAnd, msg, tx } from "./i18n.js";
import { type Manifest, nodeLabel } from "./manifest.js";
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

/** One readable line per capability, in the manifest's locale ("Sections (…): reorder, hide"). */
export function capabilityLines(caps: Capabilities, locale?: string): string[] {
  const L = locale;
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
          items: some(a.items.map((i) => i.label)),
          verbs: listAnd(verbs, L),
        }),
      );
    if (a.add.length)
      lines.push(msg(L, "capAdd", { what: a.label, items: some(a.add.map((p) => p.label)) }));
  }
  for (const s of caps.settings)
    lines.push(
      msg(L, "capSet", {
        what: s.nodeLabel && s.nodeLabel !== s.label ? `${s.label} (${s.nodeLabel})` : s.label,
        values: s.values?.length
          ? some(s.values.map((v) => v.label))
          : s.min !== undefined
            ? `${s.min}–${s.max}`
            : "",
      }),
    );
  for (const d of caps.data)
    lines.push(msg(L, "capData", { what: d.label, fields: some(d.fields.map((f) => f.label)) }));
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
