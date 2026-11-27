import { defineCatalog, defineSurface, f, type SurfaceSpec, t } from "../src/index.js";

export const catalog = defineCatalog({
  appointments: {
    label: "Appointments",
    endpoint: { path: "/api/appointments", method: "GET" },
    params: { range: { from: "filters.dateRange" } },
    complete: true,
    rowKey: "id",
    fields: {
      date: f.date({ label: "Date" }),
      vet: f.string({ label: "Vet" }),
      status: f.enum(["completed", "noShow"], {
        label: "Status",
        valueLabels: { noShow: "No-show" },
      }),
      revenue: f.currency("EUR", { label: "Revenue", requires: "finance.read" }),
      owner: f.string({ label: "Owner" }),
      ownerPhone: f.string({ label: "Owner phone", sensitive: true }),
    },
  },
  invoices: {
    label: "Invoices",
    endpoint: { path: "/api/invoices", method: "GET" },
    fields: { amount: f.currency("EUR", { label: "Amount" }), customer: f.string() },
  },
});

const base: SurfaceSpec = {
  schemaVersion: 1,
  surfaceId: "data",
  baseVersion: 1,
  root: "page",
  nodes: {
    page: {
      component: "Page",
      props: { main: [{ key: "filters" }, { key: "table" }, { key: "trend" }] },
    },
    filters: { component: "Filters", props: { dateRange: { relative: "thisMonth" } } },
    table: {
      component: "Table",
      props: { columns: [{ key: "date" }, { key: "vet" }, { key: "revenue" }] },
    },
    trend: {
      component: "Chart",
      props: {
        kind: "line",
        query: {
          source: "appointments",
          groupBy: { field: "date", bucket: "week" },
          metric: { op: "sum", field: "revenue" },
        },
      },
    },
  },
};

export const dataSurface = defineSurface<{ permissions: string[] }>({
  id: "data",
  version: 1,
  base,
  catalog,
  labels: { table: "Appointments table", trend: "Revenue trend" },
  components: {
    Page: {
      props: {
        main: t.slot({
          accepts: ["Filters", "Table", "Chart", "Stat", "List"],
          reorder: true,
          hide: true,
          insert: ["block.chart", "block.stat", "block.list"],
        }),
      },
    },
    Filters: { props: { dateRange: t.relativeDateRange(["thisWeek", "thisMonth"]) } },
    Table: {
      props: {
        columns: t.collection({
          keysFrom: { catalog, source: "appointments" },
          reorder: true,
          hide: true,
        }),
      },
    },
    Chart: {
      label: "Chart",
      props: { kind: t.enum(["line", "bar"]), query: t.query(catalog, { shape: "series" }) },
    },
    Stat: { label: "Stat", props: { query: t.query(catalog, { shape: "single" }) } },
    List: { label: "List", props: { query: t.query(catalog, { shape: "rows" }) } },
  },
  presets: {
    "block.chart": {
      label: "Chart",
      node: {
        component: "Chart",
        props: {
          kind: "bar",
          query: { source: "appointments", metric: { op: "count" }, groupBy: { field: "status" } },
        },
      },
    },
    "block.stat": {
      label: "Number card",
      node: {
        component: "Stat",
        props: { query: { source: "appointments", metric: { op: "count" } } },
      },
    },
    "block.list": {
      label: "List",
      node: {
        component: "List",
        props: { query: { source: "appointments", fields: ["date", "vet"] } },
      },
    },
  },
});
