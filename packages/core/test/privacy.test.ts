import { describe, expect, it } from "vitest";
import {
  buildModelRequest,
  capabilities,
  checkQuery,
  defineCatalog,
  defineSurface,
  f,
  type Manifest,
  publicCatalog,
  type QueryDef,
  restrictManifest,
  type SurfaceSpec,
  t,
} from "../src/index.js";

const catalog = defineCatalog({
  calls: {
    label: "Calls",
    endpoint: { path: "/api/calls", method: "GET" },
    complete: true,
    fields: {
      date: f.date({ label: "Date" }),
      task: f.string({ label: "Task" }),
      summary: f.string({ label: "Summary", privacy: "display" }),
      notes: f.string({ label: "Internal notes", privacy: "display", requires: "notes.read" }),
      phone: f.string({ label: "Phone", sensitive: true }),
    },
  },
});
const base: SurfaceSpec = {
  schemaVersion: 1,
  surfaceId: "p",
  baseVersion: 1,
  root: "page",
  nodes: {
    page: { component: "Page", props: { main: [{ key: "table" }] } },
    table: { component: "Table", props: { columns: [{ key: "date" }] } },
  },
};
const surface = defineSurface({
  id: "p",
  version: 1,
  base,
  catalog,
  components: {
    Page: {
      props: {
        main: t.slot({
          accepts: ["Table", "List", "Chart"],
          reorder: true,
          hide: true,
          insert: [],
        }),
      },
    },
    Table: {
      props: {
        columns: t.collection({
          keysFrom: { catalog, source: "calls" },
          reorder: true,
          hide: true,
        }),
      },
    },
  },
});
const rows: QueryDef = { kind: "query", catalog, shape: "rows", aggregations: [] };
const series: QueryDef = {
  kind: "query",
  catalog,
  shape: "series",
  aggregations: ["count"],
};

describe('privacy: "display"', () => {
  it("can be a table column (rows query, keysFrom)", () => {
    expect(checkQuery(rows, { source: "calls", fields: ["date", "summary"] })).toBeNull();
    expect(surface.base.nodes.table?.props.columns).toContainEqual({
      key: "summary",
      hidden: true,
    });
  });

  it("can't be filtered, grouped, sorted or aggregated", () => {
    expect(
      checkQuery(rows, {
        source: "calls",
        fields: ["date"],
        where: [{ field: "summary", value: "x" }],
      }),
    ).toMatch(/column/);
    expect(
      checkQuery(series, {
        source: "calls",
        groupBy: { field: "summary" },
        metric: { op: "count" },
      }),
    ).toMatch(/column/);
    expect(
      checkQuery(rows, {
        source: "calls",
        fields: ["date"],
        sort: { field: "summary", dir: "asc" },
      }),
    ).toMatch(/column/);
  });

  it("appears in capabilities and the browser catalog; sensitive fields don't", () => {
    const m = restrictManifest(surface as Manifest<unknown>, { permissions: [] });
    const columns = capabilities(m, m.base).arrange.find((a) => a.node === "table");
    const fields = columns?.items.map((x) => x.key);
    expect(fields).toContain("summary");
    expect(fields).not.toContain("phone");
    const pub = m.catalog ? publicCatalog(m.catalog) : null;
    expect(pub?.sources.calls?.fields.summary?.privacy).toBe("display");
  });

  it("still needs its `requires` permission", () => {
    const m = restrictManifest(surface as Manifest<unknown>, { permissions: [] });
    expect(m.catalog?.sources.calls?.fields.notes).toBeUndefined();
  });

  it("reaches the model as a name, label and kind only, never its values", () => {
    const m = restrictManifest(surface as Manifest<unknown>, {
      permissions: [],
      values: { "calls.summary": ["SECRET-VALUE-1"], "calls.task": ["Notfall"] },
    });
    const req = buildModelRequest(m, m.base, "show the summary");
    const all = JSON.stringify(req);
    expect(all).toContain("summary");
    expect(all).not.toContain("SECRET-VALUE-1");
    expect(all).toContain("Notfall"); // ordinary restricted values still do
    expect(all).not.toContain("phone");
  });

  it("can't be derived from", () => {
    expect(() =>
      defineCatalog({
        s: {
          label: "S",
          endpoint: { path: "/api/s", method: "GET" },
          fields: {
            summary: f.string({ privacy: "display" }),
            urgent: f.contains("summary", ["urgent"]),
          },
        },
      }),
    ).toThrow(/display-only/);
  });
});
