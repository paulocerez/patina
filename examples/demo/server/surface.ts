import { dataBlocks, defineSurface, type SurfaceSpec, t } from "@patina-ui/core";
import { catalog } from "../patina/catalog.js";
import type { DemoContext } from "./users.js";

export const COLUMNS = ["date", "time", "patient", "species", "vet", "status", "revenue"];
const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  time: "Time",
  patient: "Patient",
  species: "Species",
  vet: "Vet",
  status: "Status",
  revenue: "Revenue",
};

/** The base view. Bump `baseVersion` (and `version` below) whenever you change it. */
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
        columns: COLUMNS.map((key) => ({ key })),
        sort: { key: "date", dir: "desc" },
        pageSize: 10,
        density: "comfortable",
      },
    },
  },
};

/** Table, chart and number-card blocks over the catalog (rendered by patina/blocks.tsx). */
const blocks = dataBlocks(catalog);

export const dashboard = defineSurface<DemoContext>({
  catalog,
  id: "clinic.dashboard",
  version: 1,
  base: baseSpec,
  description:
    "Veterinary clinic dashboard: filters, KPI cards, a revenue chart and the appointments table.",
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
          accepts: ["FilterBar", "StatRow", "Chart", "DataTable", ...blocks.componentNames],
          reorder: true,
          hide: true,
          insert: ["block.table", "block.chart", "block.stat"],
        }),
      },
    },
    StatRow: {
      description: "A row of KPI cards, left to right.",
      props: {
        cards: t.slot({
          accepts: ["StatCard", "PatinaStat"],
          reorder: true,
          hide: true,
          insert: ["stat.noShows", "stat.avgRevenue", "block.stat"],
        }),
      },
    },
    StatCard: { label: "Card", description: "One KPI number.", props: {} },
    ...blocks.components,
    FilterBar: {
      description:
        "Filters that apply to the whole page. These are the defaults the page opens with.",
      props: {
        dateRange: t.relativeDateRange(
          ["today", "thisWeek", "lastWeek", "thisMonth", "last30Days", "last90Days"],
          {
            label: "Default date range",
          },
        ),
        status: t.enum(["all", "scheduled", "completed", "cancelled", "noShow"], {
          label: "Default status filter",
          labels: { noShow: "No-show" },
        }),
      },
    },
    Chart: {
      description: "Revenue over time.",
      props: {
        kind: t.enum(["line", "bar"], { label: "Chart type" }),
        groupBy: t.enum(["day", "week", "month"], { label: "Grouping" }),
      },
    },
    DataTable: {
      description: "Appointments table, one row per appointment.",
      props: {
        columns: t.collection({
          keys: COLUMNS,
          // Also offer every other (non-sensitive) field the API returns, hidden by default.
          keysFrom: { catalog, source: "appointments" },
          labels: COLUMN_LABELS,
          reorder: true,
          hide: true,
          item: {
            label: t.label(
              { maxLen: 30 },
              { label: "Heading", description: "Custom column heading." },
            ),
          },
        }),
        sort: t.sort(COLUMNS, { label: "Default sort" }),
        pageSize: t.int({ min: 5, max: 50 }, { label: "Rows per page" }),
        density: t.enum(["compact", "comfortable"], { label: "Row density" }),
      },
    },
  },
  presets: {
    ...blocks.presets,
    "stat.noShows": {
      label: "No-shows card",
      description: "KPI card: number of no-show appointments.",
      node: { component: "StatCard", props: { metric: "noShows" } },
    },
    "stat.avgRevenue": {
      label: "Average revenue card",
      description: "KPI card: average revenue per completed visit.",
      node: { component: "StatCard", props: { metric: "avgRevenue" } },
    },
  },
  // Users without finance access never see revenue: not in the view, not in the model prompt,
  // and (separately) not in the data API.
  restrict: (ctx) =>
    ctx.permissions.includes("finance.read")
      ? {}
      : {
          keys: ["revenue"],
          nodes: ["stat-revenue", "revenue-chart"],
          presets: ["stat.avgRevenue"],
        },
});
