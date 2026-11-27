# Getting started

This walkthrough follows [`examples/demo`](../examples/demo), a veterinary clinic dashboard
with a filter bar, KPI cards, a revenue chart and an appointments table (TanStack Table). By
the end, a user can type _"hide the revenue column and move status after date"_, preview the
result, apply it, and still see it after a reload or on another device.

The pieces:

| Where  | What you write                     | Patina provides                                 |
| ------ | ---------------------------------- | ----------------------------------------------- |
| Server | a surface definition, `getContext` | `createPatinaHandler`, a model adapter, storage |
| Client | your components, the customizer UI | `<Surface>`, `useSurface`, headless primitives  |

## 1. Describe the view as a spec

A spec is a map of nodes. Each node names one of your components and holds its props.
Layout is a prop too: a **slot** is an ordered list of child node keys.

```ts
// examples/demo/server/surface.ts
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
    // …
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
```

The spec holds **no data and no copy**. Rows, numbers and default headings come from your own
code at render time. The spec only says which of your things are shown, in what order, and
with which presentation options.

## 2. Declare what may change

```ts
export const dashboard = defineSurface<DemoContext>({
  id: "clinic.dashboard",
  version: 1,
  base: baseSpec,
  description: "Veterinary clinic dashboard: …",
  labels: { appointments: "Appointments table", "revenue-chart": "Revenue chart" /* … */ },
  components: {
    DashboardLayout: {
      props: {
        main: t.slot({
          accepts: ["FilterBar", "StatRow", "Chart", "DataTable"],
          reorder: true,
          hide: true,
        }),
      },
    },
    DataTable: {
      props: {
        columns: t.collection({
          keys: COLUMNS,
          labels: COLUMN_LABELS,
          reorder: true,
          hide: true,
          item: { label: t.label({ maxLen: 30 }, { label: "Heading" }) },
        }),
        sort: t.sort(COLUMNS),
        pageSize: t.int({ min: 5, max: 50 }, { label: "Rows per page" }),
        density: t.enum(["compact", "comfortable"]),
      },
    },
    // …
  },
  presets: {
    "stat.noShows": {
      label: "No-shows card",
      node: { component: "StatCard", props: { metric: "noShows" } },
    },
  },
  restrict: (ctx) =>
    ctx.permissions.includes("finance.read")
      ? {}
      : { keys: ["revenue"], nodes: ["stat-revenue", "revenue-chart"] },
});
```

Anything not listed here cannot be changed. `Chart.metric` isn't listed, for example, so no
prompt can point the chart at another metric. See
[Defining a surface](guides/define-a-surface.md) for every type.

## 3. Mount the handler

```ts
// examples/demo/server/index.ts
const patina = createPatinaHandler({
  surfaces: [dashboard],
  storage: memoryStorage(),
  model: anthropicModel({ model: process.env.PATINA_MODEL ?? "claude-opus-5-5" }),
  basePath: "/api/patina",
  getContext: (req) => userFromCookie(req.headers.get("cookie")),
});

const app = express();
app.use("/api/patina", toExpress(patina));
```

`getContext` is where identity comes from: your session, never the request body. Return
`null` for anonymous requests (they get a 401). See [Server setup](guides/server-setup.md).

## 4. Render with your components

```tsx
const components = { DashboardLayout, StatRow, StatCard, FilterBar, Chart, DataTable };

<PatinaProvider endpoint="/api/patina">
  <Customizer />
  <Surface id="clinic.dashboard" components={components} />
</PatinaProvider>;
```

Your components receive plain props:

- **Slot props** such as `main` arrive as an ordered `ReactNode[]`, with hidden children
  already removed: `({ main }) => <div className="sections">{main}</div>`.
- **Collection props** such as `columns` arrive as an ordered array of `{ key, ...fields }`,
  with hidden items already removed.
- **Everything else** arrives as stored, e.g. `pageSize={10}`.

The demo's `DataTable` maps `columns` straight onto TanStack Table's state:

```tsx
const columnOrder = columns.map((c) => c.key);
const columnVisibility = Object.fromEntries(ALL_KEYS.map((k) => [k, columnOrder.includes(k)]));
const table = useTable({
  features,
  columns: defs,
  data,
  state: { columnOrder, columnVisibility, sorting, pagination },
});
```

## 5. Build the customizer from the primitives

```tsx
<PromptInput surfaceId="clinic.dashboard" />          {/* text box + submit */}
<SurfaceMessage surfaceId="clinic.dashboard" />       {/* refusals, questions, errors */}
<ProposalPreview surfaceId="clinic.dashboard" />      {/* list of changes + Apply / Discard */}
<UndoButton surfaceId="clinic.dashboard" />
<ResetButton surfaceId="clinic.dashboard" />
<SkippedNotice surfaceId="clinic.dashboard" />        {/* "2 of your earlier changes no longer apply" */}
```

While a proposal is pending, `<Surface>` renders the **preview**, so the user sees the real
result in place. The change list comes from the patch itself (`describe()` in core), not from
the model's own text.

Every primitive also takes a render-prop child. The demo's `App.tsx` uses that form for its
own styling.

## 6. Try it

```sh
pnpm install
pnpm demo
```

Open http://localhost:5173 and try:

- _Hide the revenue column and move status after date_
- _Put the appointments table above the chart_
- _Default the filter to this week_
- _Add a no-shows card_
- _Show me other users' appointments_: refused, with an explanation
- Reload the page: your changes are still there. Switch to Bob: his view is separate, and
  revenue doesn't exist for him.

Without `ANTHROPIC_API_KEY`, the demo uses an offline keyword model that understands only
simple phrasings. Set the key to use Claude.

## What happens on each request

1. `POST /surfaces/:id/proposals { prompt }`: the server restricts the manifest for this user
   and builds a prompt from the **structure** of the view (no data rows). It then asks the
   model for a patch in a JSON Schema compiled from the manifest.
2. The patch is validated. If it's invalid, the model gets one chance to repair it. After
   that, the user sees the validator's readable reason.
3. A valid patch is stored as a short-lived **proposal**, and the client gets its ID, the
   change list and the preview spec.
4. `POST …/proposals/:id/commit`: the server re-validates the proposal against the current
   state and appends it to the user's history.
5. `GET /surfaces/:id`: the view is always `base + effective patches`, replayed tolerantly.
   Changes that no longer apply are skipped and reported, never crash the view.
