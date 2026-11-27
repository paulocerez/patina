import { type Catalog, type FieldDef, offerableFields } from "./catalog.js";
import { t } from "./dsl.js";
import { msgText } from "./i18n.js";
import type { ComponentDef, Manifest, PresetDef } from "./manifest.js";
import type { Query } from "./query.js";
import type { SurfaceSpec, Value } from "./types.js";

/** Component names of the generated data blocks (see `patina scan`, `patina/blocks.tsx`). */
export const BLOCK_COMPONENTS = ["PatinaTable", "PatinaChart", "PatinaStat"] as const;

/**
 * Manifest entries for the data blocks: components (with `t.query` props bound to the
 * catalog) and insertable presets with sensible default queries.
 *
 * ```ts
 * const blocks = dataBlocks(catalog);
 * defineSurface({
 *   catalog,
 *   components: { ...myComponents, ...blocks.components },
 *   presets: { ...blocks.presets },
 *   // and allow them in a slot:
 *   // main: t.slot({ accepts: [..., ...blocks.componentNames], insert: blocks.presetIds })
 * })
 * ```
 */
export function dataBlocks(catalog: Catalog) {
  const components: Record<string, ComponentDef> = {
    PatinaTable: {
      label: msgText("blockTable"),
      description: "A table of rows from one data source, showing the chosen fields.",
      props: { query: t.query(catalog, { shape: "rows" }, { label: msgText("data") }) },
    },
    PatinaChart: {
      label: msgText("blockChart"),
      description:
        "A line or bar chart: one number per group (a category, or dates by day/week/month).",
      props: {
        kind: t.enum(["bar", "line"], { label: msgText("chartType") }),
        query: t.query(catalog, { shape: "series" }, { label: msgText("data") }),
      },
    },
    PatinaStat: {
      label: msgText("blockStat"),
      description:
        "A single number: a count, total, average, minimum or maximum, optionally filtered.",
      props: { query: t.query(catalog, { shape: "single" }, { label: msgText("data") }) },
    },
  };

  const presets: Record<string, PresetDef> = {};
  const sources = Object.entries(catalog.sources).filter(
    ([, s]) => Object.keys(offerableFields(s)).length > 0,
  );
  const first = sources[0];
  if (first) {
    const [id, s] = first;
    const fields = Object.keys(offerableFields(s)).slice(0, 4);
    presets["block.table"] = {
      label: msgText("blockTable"),
      description: "A new table of data.",
      node: {
        component: "PatinaTable",
        props: { query: { source: id, fields } as unknown as Value },
      },
    };
  }
  const complete = sources.find(([, s]) => s.complete);
  if (complete) {
    const [id, s] = complete;
    const entries = Object.entries(offerableFields(s));
    const group = entries.find(
      ([, fd]) => fd.kind === "enum" || fd.kind === "string" || fd.kind === "bool",
    );
    const date = entries.find(([, fd]: [string, FieldDef]) => fd.kind === "date");
    const groupBy = group ? { field: group[0] } : date ? { field: date[0], bucket: "week" } : null;
    if (groupBy) {
      const query: Query = {
        source: id,
        groupBy: groupBy as Query["groupBy"] & object,
        metric: { op: "count" },
      };
      presets["block.chart"] = {
        label: msgText("blockChart"),
        description: "A new chart of data.",
        node: {
          component: "PatinaChart",
          props: { kind: "bar", query: query as unknown as Value },
        },
      };
    }
    presets["block.stat"] = {
      label: msgText("blockStat"),
      description: "A new card showing one number.",
      node: {
        component: "PatinaStat",
        props: { query: { source: id, metric: { op: "count" } } as unknown as Value },
      },
    };
  }
  return {
    components,
    presets,
    componentNames: [...BLOCK_COMPONENTS] as string[],
    presetIds: Object.keys(presets),
  };
}

/** Presets that create data blocks (their component has a `t.query` prop). */
export function dataPresetIds(m: Manifest<unknown>): string[] {
  return Object.entries(m.presets)
    .filter(([, p]) =>
      Object.values(m.components[p.node.component]?.props ?? {}).some((d) => d.kind === "query"),
    )
    .map(([id]) => id);
}

/**
 * The manifest without data views: no data-block presets to insert, and data queries can't be
 * changed or created. Existing blocks still render; tables keep their columns.
 */
export function withoutDataViews<Ctx>(m: Manifest<Ctx>): Manifest<Ctx> {
  const presets = new Set(dataPresetIds(m as Manifest<unknown>));
  const empty: Catalog = { sources: {} };
  const components = Object.fromEntries(
    Object.entries(m.components).map(([name, comp]) => [
      name,
      {
        ...comp,
        props: Object.fromEntries(
          Object.entries(comp.props).map(([prop, def]) => [
            prop,
            def.kind === "query"
              ? { ...def, catalog: empty }
              : def.kind === "slot"
                ? { ...def, insert: def.insert.filter((p) => !presets.has(p)) }
                : def,
          ]),
        ),
      },
    ]),
  );
  return {
    ...m,
    components,
    presets: Object.fromEntries(Object.entries(m.presets).filter(([id]) => !presets.has(id))),
    catalog: empty,
  };
}

/** Removes nodes (and their entries in slots) from a spec. */
export function removeNodes(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  ids: Set<string>,
): SurfaceSpec {
  if (ids.size === 0) return spec;
  const nodes: SurfaceSpec["nodes"] = {};
  for (const [id, node] of Object.entries(spec.nodes)) {
    if (ids.has(id)) continue;
    const props = { ...node.props };
    for (const [prop, def] of Object.entries(m.components[node.component]?.props ?? {}))
      if (def.kind === "slot" && Array.isArray(props[prop]))
        props[prop] = (props[prop] as unknown as { key: string }[]).filter(
          (it) => !ids.has(it.key),
        ) as unknown as Value;
    nodes[id] = { ...node, props };
  }
  return { ...spec, nodes };
}
