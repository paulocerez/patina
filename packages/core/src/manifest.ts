import { type Catalog, restrictCatalog } from "./catalog.js";
import { type CollectionDef, isListType, type SlotDef, type TypeDef } from "./dsl.js";
import { type Text, tx } from "./i18n.js";
import type { Migration } from "./migrate.js";
import type { NodeId, SpecNode, SurfaceSpec, Value } from "./types.js";
import { checkValue } from "./values.js";

export interface ComponentDef {
  /** Human name used in previews ("Table"). */
  label?: Text;
  /** Written for the model. */
  description?: Text;
  /** Only the props listed here can be customized. Others keep their base values. */
  props: Record<string, TypeDef>;
}

export interface PresetDef {
  label: Text;
  description?: Text;
  node: { component: string; props: Record<string, Value> };
}

/** What to take away from a manifest for one request (see `restrict`). */
export interface Restriction {
  /** Collection keys and sort keys to remove everywhere (e.g. a "revenue" column). */
  keys?: string[];
  /** Nodes to remove entirely. */
  nodes?: NodeId[];
  /** Presets the user may not insert. */
  presets?: string[];
  /** The user's permissions, checked against catalog `requires`. Set by the handler from `ctx.permissions`. */
  permissions?: string[];
  /** Catalog sources to remove. */
  sources?: string[];
  /** Catalog fields to remove, as "source.field". */
  fields?: string[];
  /**
   * This tenant's values for text fields, as "source.field" → values. The field becomes an
   * enum for this request, so views can filter on it ("calls of the Emergency task") and the
   * model knows the values. Use it for values each tenant names itself.
   */
  values?: Record<string, string[]>;
}

export interface SurfaceDefinition<Ctx = unknown> {
  id: string;
  /** The host's version of the base view. Bump it when you ship a new base spec. */
  version: number;
  base: SurfaceSpec;
  /** Written for the model: what this surface is. */
  description?: Text;
  /** Human names for nodes ("appointments" → "Appointments table"). */
  labels?: Record<NodeId, Text>;
  components: Record<string, ComponentDef>;
  presets?: Record<string, PresetDef>;
  /** Narrows the manifest for one request. Called with the host's request context. */
  restrict?(ctx: Ctx): Restriction | Promise<Restriction>;
  /** Ops authored before `version` N pass through `migrations[N]`. */
  migrations?: Record<number, Migration[]>;
  /** Data sources users may compose into new views (see `defineCatalog`). */
  catalog?: Catalog;
}

export interface Manifest<Ctx = unknown>
  extends Required<Omit<SurfaceDefinition<Ctx>, "restrict" | "catalog">> {
  catalog?: Catalog;
  restrict?(ctx: Ctx): Restriction | Promise<Restriction>;
  /** Set on manifests returned by `restrictManifest`. */
  restriction?: Restriction;
  /** The locale texts are shown in (see `localizeManifest`). Default English. */
  locale?: string;
}

/**
 * The manifest for one request's locale: Patina's own messages and host labels given per
 * language (`{ de: "Anrufe", en: "Calls" }`) are shown in this locale.
 */
export function localizeManifest<Ctx>(m: Manifest<Ctx>, locale: string): Manifest<Ctx> {
  return { ...m, locale };
}

/**
 * Declares a customizable surface. Throws at startup if the base spec does not match
 * the manifest, so mistakes surface in development rather than in a user's view.
 */
export function defineSurface<Ctx = unknown>(def: SurfaceDefinition<Ctx>): Manifest<Ctx> {
  const manifest: Manifest<Ctx> = {
    description: "",
    labels: {},
    presets: {},
    migrations: {},
    ...def,
    base: withCatalogKeys(def),
  };
  const problems = checkManifest(manifest);
  if (problems.length > 0) {
    throw new Error(`defineSurface("${def.id}") is invalid:\n  - ${problems.join("\n  - ")}`);
  }
  return manifest;
}

/**
 * Collections declared with `keysFrom` offer every catalog field; fields the base spec doesn't
 * list are appended hidden, so users can show them ("add the owner column").
 */
function withCatalogKeys<Ctx>(def: SurfaceDefinition<Ctx>): SurfaceSpec {
  let base = def.base;
  for (const [id, node] of Object.entries(def.base.nodes)) {
    for (const [prop, pdef] of Object.entries(def.components[node.component]?.props ?? {})) {
      if (pdef.kind !== "collection" || !pdef.source) continue;
      const list = Array.isArray(node.props[prop]) ? (node.props[prop] as { key: string }[]) : [];
      const missing = pdef.keys.filter((k) => !list.some((it) => it?.key === k));
      if (!missing.length) continue;
      const next = [...list, ...missing.map((key) => ({ key, hidden: true }))] as unknown as Value;
      base = {
        ...base,
        nodes: { ...base.nodes, [id]: { ...node, props: { ...node.props, [prop]: next } } },
      };
    }
  }
  return base;
}

function checkManifest(m: Manifest<unknown>): string[] {
  const out: string[] = [];
  const { base } = m;
  if (base.surfaceId !== m.id)
    out.push(`base.surfaceId "${base.surfaceId}" must equal id "${m.id}"`);
  if (base.baseVersion !== m.version)
    out.push(`base.baseVersion ${base.baseVersion} must equal version ${m.version}`);
  if (!base.nodes[base.root]) out.push(`root node "${base.root}" does not exist`);

  for (const [presetId, preset] of Object.entries(m.presets)) {
    const comp = m.components[preset.node.component];
    if (!comp)
      out.push(`preset "${presetId}" uses unregistered component "${preset.node.component}"`);
    else if (Object.values(comp.props).some((d) => d.kind === "slot"))
      out.push(`preset "${presetId}" must be a leaf component (no slots)`);
    else
      for (const [prop, value] of Object.entries(preset.node.props)) {
        const pdef = comp.props[prop];
        const err = pdef && !isListType(pdef) ? checkValue(pdef, value) : null;
        if (err) out.push(`preset "${presetId}" prop "${prop}": ${err}`);
      }
  }

  for (const [id, node] of Object.entries(base.nodes)) {
    if (id.startsWith("u_")) out.push(`node id "${id}" uses the reserved "u_" prefix`);
    const comp = m.components[node.component];
    if (!comp) {
      out.push(`node "${id}" uses unregistered component "${node.component}"`);
      continue;
    }
    for (const [prop, def] of Object.entries(comp.props)) {
      const value = node.props[prop];
      if (value === undefined) continue;
      if (isListType(def)) {
        out.push(...checkList(m, id, prop, def, value));
      } else {
        const err = checkValue(def, value);
        if (err) out.push(`node "${id}" prop "${prop}": ${err}`);
      }
    }
    for (const [prop, def] of Object.entries(comp.props)) {
      if (def.kind === "slot") {
        for (const presetId of def.insert)
          if (!m.presets[presetId])
            out.push(`slot "${id}.${prop}" allows unknown preset "${presetId}"`);
      }
    }
  }
  return out;
}

function checkList(
  m: Manifest<unknown>,
  nodeId: string,
  prop: string,
  def: CollectionDef | SlotDef,
  value: Value,
): string[] {
  const where = `node "${nodeId}" prop "${prop}"`;
  if (!Array.isArray(value)) return [`${where} must be an array of { key } items`];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.key !== "string") {
      out.push(`${where} has an item without a string key`);
      continue;
    }
    if (seen.has(item.key)) out.push(`${where} has duplicate key "${item.key}"`);
    seen.add(item.key);
    if (def.kind === "collection" && !def.keys.includes(item.key))
      out.push(`${where} has key "${item.key}" that is not listed in keys`);
    if (def.kind === "slot") {
      const child = m.base.nodes[item.key];
      if (!child) out.push(`${where} references missing node "${item.key}"`);
      else if (!def.accepts.includes(child.component))
        out.push(`${where} does not accept component "${child.component}"`);
    }
  }
  return out;
}

/** Returns a copy of the manifest with everything in `restriction` removed. */
export function restrictManifest<Ctx>(m: Manifest<Ctx>, restriction: Restriction): Manifest<Ctx> {
  const keys = new Set(restriction.keys ?? []);
  const presets = new Set(restriction.presets ?? []);
  const catalog = m.catalog
    ? restrictCatalog(m.catalog, {
        permissions: restriction.permissions ?? [],
        sources: restriction.sources ?? [],
        fields: restriction.fields ?? [],
        keys: restriction.keys ?? [],
        values: restriction.values ?? {},
      })
    : undefined;
  const nothing =
    !catalog && keys.size === 0 && presets.size === 0 && (restriction.nodes ?? []).length === 0;
  if (nothing) return { ...m, restriction };

  const components: Record<string, ComponentDef> = {};
  for (const [name, comp] of Object.entries(m.components)) {
    const props: Record<string, TypeDef> = {};
    for (const [prop, def] of Object.entries(comp.props)) {
      if (def.kind === "collection") {
        const original = def.source ? m.catalog?.sources[def.source] : undefined;
        const kept = def.source ? catalog?.sources[def.source] : undefined;
        const gone = (k: string) =>
          keys.has(k) ||
          (original !== undefined && k in original.fields && !(kept && k in kept.fields));
        props[prop] = { ...def, keys: def.keys.filter((k) => !gone(k)) };
      } else if (def.kind === "sort")
        props[prop] = { ...def, keys: def.keys.filter((k) => !keys.has(k)) };
      else if (def.kind === "slot")
        props[prop] = { ...def, insert: def.insert.filter((p) => !presets.has(p)) };
      else if (def.kind === "query" && catalog) props[prop] = { ...def, catalog };
      else props[prop] = def;
    }
    components[name] = { ...comp, props };
  }
  const keptPresets = Object.fromEntries(
    Object.entries(m.presets).filter(([id]) => !presets.has(id)),
  );
  return { ...m, components, presets: keptPresets, restriction, ...(catalog ? { catalog } : {}) };
}

/**
 * Removes what the restriction took away from a spec (nodes, collection keys, sorts on removed
 * keys, data queries the user may no longer run), so it is neither rendered nor shown to the
 * model. Uses the restricted manifest from `restrictManifest`.
 */
export function restrictSpec(m: Manifest<unknown>, spec: SurfaceSpec): SurfaceSpec {
  if (!m.restriction) return spec;
  const removedNodes = new Set(m.restriction.nodes ?? []);
  const nodes: Record<NodeId, SpecNode> = {};
  for (const [id, node] of Object.entries(spec.nodes)) {
    if (removedNodes.has(id)) continue;
    const comp = m.components[node.component];
    const props = { ...node.props };
    for (const [prop, def] of Object.entries(comp?.props ?? {})) {
      const value = props[prop];
      if (value === undefined) continue;
      if (def.kind === "collection" && Array.isArray(value))
        props[prop] = value.filter((it) => def.keys.includes((it as { key: string }).key));
      else if (def.kind === "slot" && Array.isArray(value))
        props[prop] = value.filter((it) => !removedNodes.has((it as { key: string }).key));
      else if (def.kind === "sort" || def.kind === "query") {
        if (checkValue(def, value)) delete props[prop];
      }
    }
    nodes[id] = { ...node, props };
  }
  return { ...spec, nodes };
}

/** Human name for a node. */
export function nodeLabel(m: Manifest<unknown>, spec: SurfaceSpec, id: NodeId): string {
  const own = tx(m.labels[id], m.locale);
  if (own) return own;
  const node = spec.nodes[id];
  if (node?.preset && m.presets[node.preset])
    return tx(m.presets[node.preset]?.label, m.locale) ?? id;
  const comp = node && m.components[node.component];
  const compLabel = tx(comp?.label, m.locale);
  return compLabel ? `${compLabel} “${id}”` : id;
}
