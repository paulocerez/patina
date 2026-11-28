# Data views

Besides rearranging what's already on the page, users can **compose new views of data your
API already exposes**:

- _"Add a bar chart of revenue by vet"_
- _"Add a card with the number of no-shows"_
- _"Show the owner column"_

Two things stay true:

- **No code and no business logic are generated.** A data view is a declarative patch: a
  data source from your catalog, some fields, and an optional count, total, average, minimum
  or maximum. It is validated like every other patch.
- **Data only comes from your existing read endpoints**, fetched in the browser with the
  user's own session, the same way your app already fetches it. Patina adds no endpoints and
  no queries, so your API stays in charge of who sees what.

Setting it up takes three steps: scan, review, register.

## 1. Scan the repo

```sh
npx patina scan        # inside this monorepo: node packages/cli/bin/patina.js scan --root path/to/app
```

This takes well under a second on a typical app, runs offline and costs nothing. It reads:

| Looks at                                                                          | To find                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `openapi.{json,yaml}`, `swagger.*`                                                | GET endpoints, query params, row schemas (the best source)                                            |
| `schema.prisma`                                                                   | models, field types, enums                                                                            |
| zod `z.object(...)` schemas                                                       | field types and enums                                                                                 |
| exported TS interfaces and types                                                  | field types and string-literal enums                                                                  |
| Express/Hono/Fastify `app.get(...)`, Next.js `route.ts` with `GET`, `pages/api/*` | read endpoints and their query params                                                                 |
| `package.json`                                                                    | framework, UI kit (shadcn, MUI, Chakra, Mantine, Ant, Tailwind, plain CSS), chart and table libraries |
| CSS files                                                                         | `:root` / `@theme` variables, plus classes like `.card`, `.muted`, `.badge`                           |
| `components/**`                                                                   | your `Card`, `Table`, `Badge`… and how to import them (tsconfig `paths` aliases included)             |

Routers mounted under a prefix (`app.use("/api/orders", ordersRouter)`, nested routers,
`require`) are followed, so endpoints get their full path. Paths with parameters are skipped,
except tenant placeholders (`/api/accounts/:accountId/orders`, `:orgId`, `:workspaceId`…),
which `fetch.ts` fills in.

Handlers don't have to be inline. `router.get("/", controller.list)` is followed into
`list`, into the helpers it hands `req` to (`parseListQuery(req)`), and to the return types
of the services it calls, including methods and wrapped lists
(`Promise<{ items: Order[]; total: number }>`). Exported string-literal unions
(`type Status = "new" | "done"`) become enums. The scan also notes how each endpoint pages
(`limit`/`offset`, `page`, `cursor`), its date-range params and the key its rows are under.

An endpoint is matched to its row type by the type annotations or return types near its
handler, or else by name (`/api/orders` → `Order`, `OrderSchema`, `model Order`). Detail
routes (`/orders/:id`), writes, `.env` files and anything that looks like a secret are
skipped.

The scan writes three files to `patina/`:

| File         | What it is                                                                                           | Rewritten on the next scan?                     |
| ------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `scan.json`  | a snapshot of what was found. **Commit it**: `patina check` and the GitHub Action compare against it | yes                                             |
| `catalog.ts` | a **draft** data catalog for you to review                                                           | no: a re-scan writes `catalog.draft.ts` instead |
| `blocks.tsx` | the data blocks, written with **your** UI kit, components, classes and colours                       | no: a re-scan writes `blocks.draft.tsx` instead |
| `fetch.ts`   | a `fetchSource` for the provider: paging, response envelopes, date ranges, tenant path params        | no: a re-scan writes `fetch.draft.ts` instead   |

Pass `--force` to overwrite the files you've edited.

### `--ai` (optional)

```sh
ANTHROPIC_API_KEY=… npx patina scan --ai
```

Claude refines both drafts: human labels and descriptions, sensitive fields, resolved TODOs,
and blocks that follow your conventions more closely. It receives the scan summary, the two
drafts, and at most 8 named files:

- your detected `Card` and `Table`;
- one page that uses them;
- the type files behind your endpoints.

Secrets and `.env` files are never read. The answer is checked before it's written (same
exports, no raw HTML, no URLs). Otherwise you get the deterministic drafts. Either way, you
review the result as a normal diff.

## 2. Review the catalog

The catalog is an **allowlist**. The model can only use what's in it, and only GET
endpoints are accepted.

```ts
// patina/catalog.ts
import { defineCatalog, f } from "@patina-ui/core";

export const catalog = defineCatalog({
  appointments: {
    label: "Appointments",
    description: "Every appointment in the selected date range, one row each.",
    endpoint: { path: "/api/data/appointments", method: "GET" },
    params: {
      range: { from: "filters.dateRange" }, // taken from the page's spec
      status: { from: "filters.status" },
    },
    complete: true, // returns ALL matching rows, not one page
    rowKey: "id",
    fields: {
      date: f.date({ label: "Date" }),
      vet: f.string({ label: "Vet" }),
      owner: f.string({ label: "Owner" }),
      ownerPhone: f.string({ label: "Owner phone", sensitive: true }),
      notes: f.string({ label: "Notes", privacy: "display" }), // shown on every row in the app
      status: f.enum(["scheduled", "completed", "cancelled", "noShow"], {
        label: "Status",
        valueLabels: { noShow: "No-show" },
      }),
      revenue: f.currency("EUR", { label: "Revenue", requires: "finance.read" }),
    },
  },
});
```

Go through the draft and check each of these:

- [ ] **Remove** sources users shouldn't build views from (summary endpoints, admin
      endpoints, anything that isn't a list).
- [ ] **Pick a privacy level** for anything personal or confidential (see below). The scan
      pre-flags names like phone, email, address and birth date as `sensitive`.
- [ ] **`requires: "permission"`** on fields or sources that only some users may see. It's
      checked against `ctx.permissions` from your `getContext`.
- [ ] **`params`**: bind query params to page state with `{ from: "nodeId.prop" }` (for
      example a filter's default), or fix them with `{ value }`.
- [ ] **`complete: true`** only if the endpoint returns _all_ matching rows. Patina only offers
      counts, totals and averages over complete sources, so a total is never silently
      computed over one page.
- [ ] Labels, `valueLabels` for enums, and currency codes.

`defineCatalog` throws at startup on anything unsafe: non-GET methods, absolute or `..`
paths, enums without values, and so on.

### Answer the questions users actually ask

Most refused requests aren't about data you don't have. They ask for a **dimension** the rows
don't carry as such ("calls by weekday", "short vs. long calls", "emergencies"), a **filter**
on a value each customer names themselves ("calls of our Emergency task"), or a **different
period** for one card ("no-shows this week"). Three catalog features cover these, without new
endpoints:

**Derived fields** are computed in the browser from another field of the same row.
They are declarative, so the host writes no code and Patina evaluates them:

```ts
fields: {
  startedAt: f.date({ label: "Date" }),
  duration: f.number({ label: "Duration (s)" }),
  task: f.string({ label: "Task" }),
  weekday: f.weekday("startedAt", { label: "Weekday", timeZone: "Europe/Berlin" }),
  hour: f.hour("startedAt", { label: "Hour" }),
  length: f.ranges("duration", [
    { value: "short", below: 30 },
    { value: "normal", below: 300 },
    { value: "long" },
  ], { label: "Length", valueLabels: { short: "Short (under 30 s)" } }),
  emergency: f.contains("task", ["emergency", "urgent"], { label: "Emergency" }),
},
```

`weekday`, `hour` and `ranges` are enums and `contains` is a yes/no field, so they can be
grouped, filtered and shown like any other field. Charts keep their natural order (Monday
first, short before long). A derived field can't read a sensitive field: what it reads would
leak into views.

**Values per tenant.** A text field can be filtered only if its values are known. When each
tenant names its own (task types, locations, vets), return them from `restrict`. It may be
async:

```ts
restrict: async (ctx) => ({
  values: { "calls.task": await taskNames(ctx.tenantId) },
}),
```

For that request the field becomes an enum of those values: views can filter on it and the
model knows the names.

**Per-view params.** Give a param `choices`, and a single view may pick its own value instead
of the page's. Your `fetchSource` receives it as usual:

```ts
params: {
  range: {
    from: "filters.dateRange", // the default
    label: "Date range",
    choices: ["today", "thisWeek", "thisMonth", "last30days"],
    choiceLabels: { thisWeek: "This week", thisMonth: "This month" },
  },
},
```

A card of _"no-shows this week"_ then carries `params: { range: "thisWeek" }`, and its title
says so.

Check the request log ([Insights](insights.md)) for what users ask for: it shows which of
these to add next.

## 3. Register the blocks

```ts
import { dataBlocks, defineSurface, t } from "@patina-ui/core";
import { catalog } from "../patina/catalog";

const blocks = dataBlocks(catalog); // PatinaTable, PatinaChart, PatinaStat + presets

export const dashboard = defineSurface({
  catalog,
  components: {
    ...myComponents,
    ...blocks.components,
    Page: {
      props: {
        main: t.slot({
          accepts: [...myComponentNames, ...blocks.componentNames],
          insert: blocks.presetIds, // "block.table", "block.chart", "block.stat"
          reorder: true,
          hide: true,
        }),
      },
    },
    // Offer every other API field as a column, hidden until a user shows it:
    OrdersTable: {
      props: {
        columns: t.collection({
          keys: ["date", "total"],
          keysFrom: { catalog, source: "orders" },
          reorder: true,
          hide: true,
        }),
      },
    },
  },
  presets: { ...blocks.presets },
  // …
});
```

```tsx
import { PatinaChart, PatinaStat, PatinaTable } from "../patina/blocks";

<PatinaProvider endpoint="/api/patina">
  <Surface id="dashboard" components={{ ...myComponents, PatinaTable, PatinaChart, PatinaStat }} />
</PatinaProvider>;
```

**On a page that renders itself** (the [hooks path](react.md#existing-pages-useslot-usecollection-usesurfaceprop)),
switch the slot from `useSlot` to `useSlotItems` and render inserted blocks with
`<PatinaBlock surfaceId="dashboard" nodeId={item.key} components={{ PatinaTable, PatinaChart, PatinaStat }} />`.
See [Adding data views to such a page](react.md#adding-data-views-to-such-a-page).

The three blocks are ordinary components in your repo. Edit them however you like, as long as
they keep reading data through `useQuery(query)` from `@patina-ui/react`.

| Block         | Query shape                                                                                | Example                                                |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `PatinaTable` | `rows`: up to 12 fields, optional sort, limit and filters                                  | _"a table of appointments with vet, owner and status"_ |
| `PatinaChart` | `series`: group by a field (dates by day, week or month), plus count, sum, avg, min or max | _"revenue by vet"_                                     |
| `PatinaStat`  | `single`: one count, sum, avg, min or max, optionally filtered                             | _"number of no-shows"_                                 |

Filters (`where`) are simple equality filters on enum and boolean fields. Aggregation is
plain arithmetic over the rows your endpoint returned, done in the browser.

## How data is fetched

Most apps don't need to write this. `patina scan` drafts `patina/fetch.ts`:

```ts
import { createFetchSource } from "@patina-ui/react";

export const appFetchSource = ({ accountId }: { accountId: string }) =>
  createFetchSource({
    baseUrl: import.meta.env.VITE_API_URL,
    credentials: "include",
    params: { accountId }, // also fills :accountId in paths
    sources: {
      calls: {
        rows: "items",
        paging: { style: "offset", size: 200, limit: "limit", offset: "offset", total: "total" },
        dateRange: { from: "fromDate", to: "toDate" }, // a relative "range" param → two dates
      },
    },
  });
```

With `paging`, every page is fetched one after another (up to `maxPages`, default 50), so a
paged endpoint can be `complete: true`. `dateRange` turns a relative range ("today",
"last7Days", "thisWeek", "lastMonth"…, case-insensitive) into the endpoint's own start and end,
as timestamps or `format: "date"`. Write your own `fetchSource` only for what this doesn't
cover.

### Writing your own

`useQuery` calls the provider's `fetchSource`. By default it does a same-origin GET of the
source's path with the bound params and the user's cookies. It accepts a JSON array, or an
object with a `rows`, `data`, `items` or `results` array. Requests are deduplicated and cached
for 10 seconds.

Pass your own to go through your data layer, add headers, or use live page state:

```tsx
<PatinaProvider
  endpoint="/api/patina"
  fetchSource={({ path, params, signal }) =>
    queryClient.fetchQuery({ queryKey: [path, params], queryFn: () => api.get(path, { params, signal }) })
  }
>
```

### Privacy levels

| Level                                    | Shown as a column in new tables, listed in capabilities | Filter, group, sort, aggregate | The model sees            |
| ---------------------------------------- | :-----------------------------------------------------: | :----------------------------: | ------------------------- |
| (default)                                |                           yes                           |              yes               | name, label, kind, values |
| `privacy: "display"`                     |                           yes                           |               no               | name, label and kind only |
| `sensitive: true` (= `privacy: "never"`) |                           no                            |               no               | nothing                   |

**How to pick: can the user already see this value somewhere in your app? Then `display`, not
`sensitive`.** A call summary users read on every call row, a note on each appointment, a
customer's name in a list: hiding them from Patina only stops users from putting data they
already see where they want it, and those requests get refused. Keep `sensitive` for values
users don't see in the app (internal scores, secrets, other people's contact details), and for
anything you don't want the model to know exists.

A display-only field's values never reach the model, even after `restrict.values`. It can't be
used in `where`, `groupBy`, `sort` or `metric` (the validator rejects it with "can show … as a
column, but not filter, group, sort or count by it"), and no derived field can read it.
`requires` applies at every level. The browser's catalog keeps `privacy: "display"` on the field.

## What the model sees

Each source's label, description, field kinds, labels and enum values, and whether it can be
aggregated. Display-only fields appear with their name, label and kind only, marked
`displayOnly`. It never sees endpoint paths, data rows, or sensitive or restricted fields. Its
output schema lists only the sources and fields this user may use, so _"add a chart of
revenue"_ for a user without `finance.read` is refused with a readable reason.

## Keeping the catalog in sync

Run `npx patina check` locally, or add the [GitHub Action](github-action.md) so every PR that
changes your API or design system gets a comment about what affects the catalog.
