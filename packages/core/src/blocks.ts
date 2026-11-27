import { type Catalog, type FieldDef, offerableFields } from "./catalog.js";
import { t } from "./dsl.js";
import type { ComponentDef, PresetDef } from "./manifest.js";
import type { Query } from "./query.js";
import type { Value } from "./types.js";

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
      label: "Table",
      description: "A table of rows from one data source, showing the chosen fields.",
      props: { query: t.query(catalog, { shape: "rows" }, { label: "Data" }) },
    },
    PatinaChart: {
      label: "Chart",
      description:
        "A line or bar chart: one number per group (a category, or dates by day/week/month).",
      props: {
        kind: t.enum(["bar", "line"], { label: "Chart type" }),
        query: t.query(catalog, { shape: "series" }, { label: "Data" }),
      },
    },
    PatinaStat: {
      label: "Number card",
      description:
        "A single number: a count, total, average, minimum or maximum, optionally filtered.",
      props: { query: t.query(catalog, { shape: "single" }, { label: "Data" }) },
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
      label: "Table",
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
        label: "Chart",
        description: "A new chart of data.",
        node: {
          component: "PatinaChart",
          props: { kind: "bar", query: query as unknown as Value },
        },
      };
    }
    presets["block.stat"] = {
      label: "Number card",
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
