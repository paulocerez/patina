import { defineSurface, type SurfaceSpec, t } from "../src/index.js";

export const COLUMN_KEYS = ["date", "patient", "vet", "status", "revenue"];

export const baseSpec: SurfaceSpec = {
  schemaVersion: 1,
  surfaceId: "clinic.dashboard",
  baseVersion: 1,
  root: "page",
  nodes: {
    page: {
      component: "DashboardLayout",
      props: {
        main: [
          { key: "filters" },
          { key: "kpis" },
          { key: "revenue-chart" },
          { key: "appointments" },
        ],
      },
    },
    filters: {
      component: "FilterBar",
      props: { dateRange: { relative: "last30Days" }, status: "all" },
    },
    kpis: {
      component: "StatRow",
      props: { cards: [{ key: "stat-visits" }, { key: "stat-revenue" }] },
    },
    "stat-visits": { component: "StatCard", props: { metric: "visits" } },
    "stat-revenue": { component: "StatCard", props: { metric: "revenue" } },
    "revenue-chart": {
      component: "Chart",
      props: { kind: "line", metric: "revenue", groupBy: "week" },
    },
    appointments: {
      component: "DataTable",
      props: {
        columns: COLUMN_KEYS.map((key) => ({ key })),
        sort: { key: "date", dir: "desc" },
        pageSize: 25,
        density: "comfortable",
      },
    },
  },
};

export const dashboard = defineSurface<{ permissions: string[] }>({
  id: "clinic.dashboard",
  version: 1,
  base: baseSpec,
  description: "Clinic overview dashboard: appointments, visits and revenue.",
  labels: {
    page: "Page",
    filters: "Filters",
    kpis: "Key metrics",
    "stat-visits": "Visits card",
    "stat-revenue": "Revenue card",
    "revenue-chart": "Revenue chart",
    appointments: "Appointments table",
  },
  components: {
    DashboardLayout: {
      description: "The page. Sections in `main` render top to bottom.",
      props: {
        main: t.slot({
          accepts: ["FilterBar", "StatRow", "Chart", "DataTable"],
          reorder: true,
          hide: true,
        }),
      },
    },
    StatRow: {
      description: "A row of KPI cards.",
      props: {
        cards: t.slot({
          accepts: ["StatCard"],
          reorder: true,
          hide: true,
          insert: ["stat.noShows"],
        }),
      },
    },
    StatCard: { props: {} },
    FilterBar: {
      props: {
        dateRange: t.relativeDateRange(
          ["today", "thisWeek", "thisMonth", "last30Days", "last90Days"],
          {
            label: "Date range",
          },
        ),
        status: t.enum(["all", "scheduled", "completed", "cancelled"], { label: "Status filter" }),
      },
    },
    Chart: { props: { kind: t.enum(["line", "bar"]), groupBy: t.enum(["day", "week", "month"]) } },
    DataTable: {
      props: {
        columns: t.collection({
          keys: COLUMN_KEYS,
          labels: {
            date: "Date",
            patient: "Patient",
            vet: "Vet",
            status: "Status",
            revenue: "Revenue",
          },
          reorder: true,
          hide: true,
          item: { label: t.label({ maxLen: 40 }, { label: "Heading" }) },
        }),
        sort: t.sort(COLUMN_KEYS),
        pageSize: t.int({ min: 10, max: 100 }, { label: "Rows per page" }),
        density: t.enum(["compact", "comfortable"]),
      },
    },
  },
  presets: {
    "stat.noShows": {
      label: "No-shows card",
      description: "KPI card: number of no-show appointments.",
      node: { component: "StatCard", props: { metric: "noShows" } },
    },
  },
  restrict: (ctx) =>
    ctx.permissions.includes("finance.read")
      ? {}
      : { keys: ["revenue"], nodes: ["stat-revenue", "revenue-chart"] },
});

/** The example patch from ARCHITECTURE.md §4. */
export const briefPatch = {
  id: "p_brief",
  schemaVersion: 1 as const,
  baseVersion: 1,
  ops: [
    {
      op: "set" as const,
      node: "appointments",
      path: ["columns", "revenue", "hidden"] as [string, string, string],
      value: true,
    },
    {
      op: "move" as const,
      node: "page",
      prop: "main",
      key: "appointments",
      to: { before: "revenue-chart" },
    },
    {
      op: "set" as const,
      node: "filters",
      path: ["dateRange"] as [string],
      value: { relative: "thisWeek" },
    },
  ],
};
