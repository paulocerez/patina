---
name: patina-ui
description: Integrate Patina UI (@patina-ui/*) into a web app so end users can customize views in plain language. Use when adding prompt-driven customization, declaring customizable surfaces or manifests, mounting the Patina server handler, rendering <Surface>, setting up data views with `patina scan`, availability/feature flags, quotas, insights, or the Patina GitHub Action.
---

# Integrating Patina UI

Patina UI lets an app's end users customize chosen views in plain language ("hide the
revenue column, put the table above the chart"). The model never writes code. It returns a
declarative **patch** against a schema the host declares (the **manifest**). Patches are
validated, previewed, stored per user, and replayed on every load.

Your job as the coding agent is to wire Patina into the host app **without changing how the
app looks or behaves until a user customizes something**, and without weakening its
security.

Docs: https://github.com/paulocerez/patina (start with `docs/getting-started.md`). Packages:

| Package                | Use                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@patina-ui/core`      | `defineSurface`, `t.*` types, `defineCatalog`, `f.*`, `dataBlocks`, `migrations` (no deps)                                                                                                          |
| `@patina-ui/server`    | `createPatinaHandler`, `memoryStorage`, `postgresStorage`, `migratePostgres`; subpaths `/anthropic` (`anthropicModel`), `/express` (`toExpress`), `/testing` (`scriptedModel`), `/eval` (`runEval`) |
| `@patina-ui/react`     | `PatinaProvider`, `Surface`, `useSurface`, `PromptInput`, `ProposalPreview`, `SurfaceMessage`, `UndoButton`, `ResetButton`, `SkippedNotice`, `AvailabilityNotice`, `useQuery`, `formatField`        |
| `@patina-ui/cli` (dev) | `patina scan`, `patina check`, `patina insights`, `patina init-action`, `patina init-agent`                                                                                                         |

```sh
npm i @patina-ui/core @patina-ui/server @patina-ui/react @anthropic-ai/sdk
npm i -D @patina-ui/cli
```

## Non-negotiable rules

1. **Never let the model produce code, HTML, CSS, URLs or scripts.** Don't add `eval`,
   `new Function` or `dangerouslySetInnerHTML` anywhere in the Patina path. Everything a user can
   change must be declared with the closed `t.*` types.
2. **Identity comes from the host's session only.** `getContext(request)` reads the existing
   auth (cookie, token). It never reads a user ID from the request body. Return `null` when
   unauthenticated.
3. **Permissions stay in the host's data layer.** Patina only presents what the host already
   serves. Use `restrict(ctx)` so restricted columns or nodes aren't _offered_, and keep
   enforcing access in the API so they aren't _served_.
4. **API keys stay on the server.** `anthropicModel()` reads `ANTHROPIC_API_KEY` server-side.
   Never expose it to the client bundle.
5. **The base spec must reproduce the current UI exactly.** Same components, order, columns
   and defaults. Apart from the Patina controls you add (prompt box, undo, reset), nothing
   visible changes until a user applies a change.
6. **Only open props the component already honours.** If you open something the app doesn't
   do yet (for example `pageSize` on a table without pagination), implement it in the
   component so that the default renders exactly as before, e.g. no pager when everything fits.
7. **Node IDs and keys are permanent.** Stored patches refer to them. To rename one, bump
   `version` and `base.baseVersion` together and add a migration (`migrations.renameKey`,
   `renameProp`, `renameNode`). Never reuse a key for something else.
8. **Match the app's language.** If the app is localized, pass `locale` to `<PatinaProvider>`
   (e.g. `i18n.language`), and give user-visible labels per language:
   `label: { en: "Orders", de: "Bestellungen" }`. English and German are built in. Write
   `description`s in English, since only the model reads them.
9. **Don't put secrets in descriptions or labels.** The model sees them and can paraphrase them
   to users.
10. **Data views read only existing GET endpoints.** In the catalog:
   - mark personal fields `sensitive: true`;
   - gate fields by permission with `requires`;
   - set `complete: true` only if the endpoint returns _all_ matching rows (no pagination).

## Step by step

### 1. Pick one view and model it as a surface (server-side module)

Start with one table-like view. Describe its current state as a **base spec**, which is a map
of nodes. Layout is a `t.slot` prop that holds ordered `{ key }` items. Then declare what may
change.

A surface can be a single node (`root: "table"`). Use the smallest spec that reproduces the
view, and add page or filter nodes only if users should rearrange or configure them. The
example below shows the larger form.

```ts
// patina/surfaces/orders.ts
import { defineSurface, t } from "@patina-ui/core";
import type { PatinaContext } from "@patina-ui/server";

/** What getContext returns. userId is required; tenantId and permissions are optional. */
export type AppContext = PatinaContext & { permissions: string[] };

export const orders = defineSurface<AppContext>({
  id: "orders",
  version: 1,
  description: "List of customer orders.", // for the model
  base: {
    schemaVersion: 1,
    surfaceId: "orders", // must equal id
    baseVersion: 1, // must equal version
    root: "page",
    nodes: {
      page: { component: "OrdersPage", props: { main: [{ key: "filters" }, { key: "table" }] } },
      filters: { component: "OrderFilters", props: { dateRange: { relative: "last30Days" } } },
      table: {
        component: "OrdersTable",
        props: {
          columns: [{ key: "date" }, { key: "customer" }, { key: "total" }, { key: "status" }],
          pageSize: 25,
        },
      },
    },
  },
  labels: { table: "Orders table", filters: "Filters" }, // human names for previews and the model
  components: {
    OrdersPage: {
      props: {
        main: t.slot({ accepts: ["OrderFilters", "OrdersTable"], reorder: true, hide: true }),
      },
    },
    OrderFilters: {
      props: {
        dateRange: t.relativeDateRange(["today", "thisWeek", "thisMonth", "last30Days"], {
          label: "Default date range",
        }),
      },
    },
    OrdersTable: {
      description: "One row per order.",
      props: {
        columns: t.collection({
          keys: ["date", "customer", "total", "status"],
          labels: { date: "Date", customer: "Customer", total: "Total", status: "Status" },
          reorder: true,
          hide: true,
          item: { label: t.label({ maxLen: 30 }, { label: "Heading" }) }, // optional: renamable headings
        }),
        sort: t.sort(["date", "customer", "total"]),
        pageSize: t.int({ min: 10, max: 100 }, { label: "Rows per page" }),
      },
    },
  },
  restrict: (ctx) => (ctx.permissions.includes("finance.read") ? {} : { keys: ["total"] }),
});
```

**Types:**

- **Scalars:** `t.enum(values, { labels })`, `t.int({ min, max })`, `t.bool()`,
  `t.label({ maxLen })`, `t.relativeDateRange(allowed)`, `t.sort(keys)`, `t.object(fields)`.
- **Lists:** `t.collection({ keys | keysFrom, labels, reorder, hide, item })` and
  `t.slot({ accepts, reorder, hide, insert: presetIds })`.
- **Data:** `t.query(catalog, { shape })`.
- **Metadata:** the last argument of each type is `{ label, description }`.

Props that aren't listed can't change. `defineSurface` throws at startup if the base and the
manifest disagree. Read the error; it lists each problem.

### 2. Adapt the host components to take what Patina passes

`<Surface>` renders each node as `<Component {...props} nodeId="…" />`:

| Prop type      | What the component receives                                                                   |
| -------------- | --------------------------------------------------------------------------------------------- |
| `t.slot`       | `ReactNode[]`, ordered, hidden children removed. Render it: `({ main }) => <div>{main}</div>` |
| `t.collection` | `{ key, ...itemFields }[]`, ordered, hidden items removed                                     |
| anything else  | the stored value (`25`, `{ relative: "thisWeek" }`, …)                                        |

The usual change: the table takes `columns` (visible keys in order) instead of hard-coding
them, and maps keys to its existing column definitions. Keep each component's own data
fetching and markup.

### 3. Mount the server handler

```ts
import { createPatinaHandler, postgresStorage, migratePostgres } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";

const query = (sql: string, params?: unknown[]) => pool.query(sql, params); // pg, PGlite, postgres.js shim
await migratePostgres(query); // or copy POSTGRES_SCHEMA into the app's migrations

export const patina = createPatinaHandler({
  surfaces: [orders],
  storage: postgresStorage({ query }),
  model: anthropicModel(), // ANTHROPIC_API_KEY; Claude Haiku 5.5 answers, Sonnet 5.5 is the backup
  basePath: "/api/patina",
  getContext: async (req: Request): Promise<AppContext | null> => {
    const session = await getSession(req); // the app's existing auth
    return session
      ? { userId: session.userId, tenantId: session.orgId, permissions: session.permissions }
      : null;
  },
});
```

- **`getContext` gets a Fetch `Request`**, even under Express. Read cookies with
  `req.headers.get("cookie") ?? undefined` (`get` returns `null`, not `undefined`), and headers
  likewise.
- **`memoryStorage()` is for prototypes and tests.** Customizations survive page reloads but
  are lost when the server restarts.
- **No API key yet?** Use a scripted model until one is set (answer format below):

  ```ts
  import { scriptedModel } from "@patina-ui/server/testing";
  const model = process.env.ANTHROPIC_API_KEY
    ? anthropicModel()
    : scriptedModel((_request, prompt) =>
        /delete/i.test(prompt)
          ? { kind: "refusal", message: "I can only change how orders are shown.", category: "action", ops: [] }
          : { kind: "patch", message: "Hid total", ops: [{ op: "setItem", node: "table", prop: "columns", key: "total", field: "hidden", value: true }] },
      );
  ```

Mount it where the app's API lives. It's a fetch handler, `(Request) => Promise<Response>`:

| Framework            | How                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Express / Node       | `app.use("/api/patina", toExpress(patina))` with `import { toExpress } from "@patina-ui/server/express"` |
| Next.js App Router   | `app/api/patina/[...path]/route.ts`: `export { patina as GET, patina as POST };`                         |
| Hono                 | `app.all("/api/patina/*", (c) => patina(c.req.raw))`                                                     |
| Remix / React Router | `export const loader = ({ request }) => patina(request); export const action = loader;`                  |

If the front end has its own dev server (for example Vite), proxy `/api` to the back end.

**Make sure the server code is typechecked.** Vite's React template runs `tsc -b` on `src/`
and `vite.config.ts` only. Add your server entry and the `patina/` folder to a tsconfig
(e.g. `tsconfig.node.json`'s `include`). Under `"module": "nodenext"`, relative imports
need their extension (`./patina/surfaces/orders.ts` or `.js`, depending on the setup).

**HTTP API.** The React components call these routes for you. You need them for curl checks
and tests:

| Route                                                       | Body                | Returns                                                                                                                     |
| ----------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET {basePath}/surfaces/:id`                               |                     | `{ spec, canUndo, isCustomized, availability, skipped, render, catalog? }`                                                  |
| `POST {basePath}/surfaces/:id/proposals`                    | `{ "prompt": "…" }` | `{ kind: "proposal", proposalId, changes, previewSpec }`, `{ kind: "refusal", message }` or `{ kind: "clarify", question }` |
| `POST {basePath}/surfaces/:id/proposals/:proposalId/commit` |                     | the new state (409 if the preview is gone or isn't this user's)                                                             |
| `POST {basePath}/surfaces/:id/undo`, `…/reset`              |                     | the new state                                                                                                               |
| `GET {basePath}/insights`                                   |                     | the insights report (only with `insights.allow`)                                                                            |

Errors are `{ error: { message } }`: 401 without a session, 403 when unavailable, 429 for
quotas and rate limits.

### 4. Render it (client)

```tsx
import { AvailabilityNotice, PatinaProvider, PromptInput, ProposalPreview, ResetButton, Surface, SurfaceMessage, UndoButton } from "@patina-ui/react";

<PatinaProvider endpoint="/api/patina" locale={i18n.language}>
  <AvailabilityNotice surfaceId="orders" />  {/* the host's message when customizing is off */}
  <PromptInput surfaceId="orders" />
  <SurfaceMessage surfaceId="orders" />      {/* refusals, clarifying questions, errors */}
  <ProposalPreview surfaceId="orders" />     {/* change list + Apply / Discard; Surface shows the preview */}
  <UndoButton surfaceId="orders" />
  <ResetButton surfaceId="orders" />
  <Surface id="orders" components={{ OrdersPage, OrderFilters, OrdersTable }} fallback={<Skeleton />} />
</PatinaProvider>
```

The primitives are unstyled. Style them with the app's design system: pass `className`, or use
their render-prop form, as in `<ProposalPreview>{({ changes, commit, discard }) => …}</ProposalPreview>`.
Show `changes` (generated from the patch), not the model's `summary`. The bundle is already
`"use client"` for Next.js.

### 5. Optional: data views from the app's existing API

```sh
npx patina scan        # writes patina/scan.json, patina/catalog.ts (draft), patina/blocks.tsx
```

1. **Review `patina/catalog.ts`:**
   - remove endpoints users shouldn't build views from;
   - mark personal fields `sensitive: true`;
   - set `requires: "<permission>"` where needed;
   - bind params with `{ from: "nodeId.prop" }`;
   - set `complete: true` only for endpoints that return every row.
2. **Register the blocks:**

   ```ts
   const blocks = dataBlocks(catalog);
   // in defineSurface:
   //   catalog;
   //   components: { ...blocks.components };
   //   presets: { ...blocks.presets };
   //   slot: accepts: [..., ...blocks.componentNames], insert: blocks.presetIds
   ```
3. **Pass the blocks to `<Surface>`:** add `PatinaTable`, `PatinaChart` and `PatinaStat` from
   `patina/blocks.tsx`.
4. **Offer API fields as hidden-by-default columns** with
   `t.collection({ keysFrom: { catalog, source } })`.
5. **Commit `patina/scan.json`**, then run `npx patina init-action` so PRs that break the
   catalog get flagged.

### 6. Optional: who gets it, quotas, insights

```ts
createPatinaHandler({
  // …
  availability: async (ctx, surfaceId) => ({
    customize: await flags.isEnabled("patina", ctx), // any flag provider
    dataViews: ctx.plan !== "free",
    message: ctx.plan === "free" ? "New charts are part of the Pro plan." : undefined,
    // whenOff: "keep" (default) keeps saved customizations visible but frozen; "base" shows the default view
  }),
  limits: { monthlyProposals: (ctx) => (ctx.plan === "pro" ? { user: 500 } : { tenant: 50 }) },
  onEvent: (e) => analytics.track(`patina_${e.outcome}`, e), // every request: outcome, reason, prompt
  insights: { allow: (ctx) => ctx.isStaff }, // GET /api/patina/insights
});
```

Clear old prompts on a schedule with `storage.redactPrompts(cutoffDate)`.

## Verify before you finish

1. **Typecheck and build** the app.
2. **The page looks exactly as before** (rule 5). Compare it with the pre-Patina version.
3. **Run the flow end to end without API costs**, using `scriptedModel` from
   `@patina-ui/server/testing`:

   ```ts
   const model = scriptedModel(() => ({ kind: "patch", message: "Hid total",
     ops: [{ op: "setItem", node: "table", prop: "columns", key: "total", field: "hidden", value: true }] }));
   ```

   Check that it previews, applies, survives a reload, that another user still sees the
   default, and that undo and reset work.

   **Answers a scripted (or real) model returns.** This is the raw JSON format. Patina
   validates it.

   | Kind    | Shape                                                                                                                                  |
   | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | patch   | `{ kind: "patch", message, ops: [...] }`                                                                                               |
   | refusal | `{ kind: "refusal", message, category }`, where category is data_access, action, new_component, styling, not_on_page, unclear or other |
   | clarify | `{ kind: "clarify", message }` (the question)                                                                                          |

   | Op                                      | Shape                                                                                                               |
   | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
   | change a prop                           | `{ op: "set", node, prop, value }`                                                                                  |
   | change a list item (e.g. hide a column) | `{ op: "setItem", node, prop, key, field, value }`, e.g. field `"hidden"` with `true` / `false`                     |
   | reorder                                 | `{ op: "move", node, prop, key, position: "before" \| "after" \| "start" \| "end", anchor: "<sibling key>" or "" }` |
   | add a preset                            | `{ op: "insert", node, prop, preset, position, anchor, props? }`                                                    |
   | remove what a user added                | `{ op: "remove", node, prop, key }`                                                                                 |
4. **A refusal works:** a request outside the manifest (e.g. "delete all orders") shows a
   readable message and changes nothing.
5. **Restricted things stay hidden:** a user without permission doesn't get restricted
   columns in `GET /api/patina/surfaces/<id>`.
6. **With `ANTHROPIC_API_KEY` set,** try 5–10 real prompts. Add the ones users will type to an
   eval set (`runEval` from `@patina-ui/server/eval`).

## Common mistakes

| Symptom                                                                    | Cause                                                                                                                  |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `defineSurface(...) is invalid`                                            | the base spec and manifest disagree: a missing node, an unregistered component, an out-of-range value                  |
| 401 from `/api/patina/...`                                                 | `getContext` can't read the session on that request (cookies not forwarded, wrong auth helper)                         |
| 404 from `/api/patina/...`                                                 | `basePath` doesn't match the mount path, or the surface `id` differs from `surfaceId` / `<Surface id>`                 |
| A node renders nothing                                                     | no component registered under that name in `<Surface components>`                                                      |
| Everything is refused                                                      | the request isn't expressible in the manifest; improve `description`s and `labels`, or open more props                 |
| A column the user asked for doesn't exist                                  | it isn't in `keys` (or `keysFrom`), or `restrict` / `requires` removed it for this user                                |
| TypeScript says the manifest isn't assignable to `Manifest<PatinaContext>` | annotate `getContext`'s parameter (`(req: Request) =>`) or pass the context type: `createPatinaHandler<AppContext>(…)` |
