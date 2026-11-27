# Trying Patina in your own app

About 15 minutes for an app with a React front end and a Node back end. The packages are ESM
with TypeScript types, and need React 18+ and Node 20+.

## 1. Install

```sh
npm i @patina-ui/core @patina-ui/server @patina-ui/react @anthropic-ai/sdk
npm i -D @patina-ui/cli
```

(`pnpm add` and `yarn add` work the same way.)

## 2. Optional: let a coding agent do it

```sh
npx patina init-agent --agents-md   # installs the Patina UI skill (Claude Code) + an AGENTS.md pointer
```

Then give your agent a task like _"Make the orders table on /orders customizable (column
order, visibility, rows per page) for signed-in users, and run the verification checklist."_
The skill covers the steps below, the rules, and how to check the result. Doing it by hand
works too: read on.

## 3. Pick one view to make customizable

Start with something simple that has an obvious "what to change": a table with a handful of
columns works best. You'll need:

1. **A base spec.** Your view's default layout, as nodes. Usually that's a single node for a
   table.
2. **A manifest.** What may change. To start, use a `t.collection` for the columns with
   `reorder: true, hide: true`.
3. **A component** that takes the props from the spec and renders your existing table.

The [README quick start](../../README.md#quick-start) has a complete `orders` example for
all three. [Defining a surface](define-a-surface.md) explains every option.

The usual change to your existing table component is to have it take the visible columns,
in order, as a prop:

```tsx
// Before: columns hard-coded inside the component.
// After: Patina hands you the user's visible columns, in their order.
function OrdersTable({ columns }: { columns: { key: string; label?: string }[] }) {
  return <ExistingTable columns={columns.map((c) => ALL_COLUMNS[c.key])} />;
}
```

## 4. Mount the server handler

Put this wherever your API lives. The important part is `getContext`: return the signed-in
user from **your** session.

```ts
import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";

export const patina = createPatinaHandler({
  surfaces: [orders],
  storage: memoryStorage(), // fine for trying it out; see "Persist it" below
  model: anthropicModel(), // reads ANTHROPIC_API_KEY
  basePath: "/api/patina",
  getContext: async (req) => {
    const user = await yourAuth(req); // e.g. read your session cookie
    return user ? { userId: user.id } : null;
  },
});
```

Then mount it for your framework:

| Framework                | Mounting                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Express                  | `app.use("/api/patina", toExpress(patina))` with `import { toExpress } from "@patina-ui/server/express"`     |
| Next.js App Router       | `app/api/patina/[...path]/route.ts`: `export { patina as GET, patina as POST }`                              |
| Hono                     | `app.all("/api/patina/*", (c) => patina(c.req.raw))`                                                         |
| Remix / React Router     | in a resource route: `export const loader = ({ request }) => patina(request); export const action = loader;` |
| Fastify, Koa, plain Node | `toExpress(patina)` works as a plain `(req, res)` Node handler                                               |

If your front end runs on its own dev server (Vite, for example), proxy `/api` to your
back end. This is the usual `server.proxy` entry in `vite.config.ts`.

Set the key in your server's environment, never in the browser:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
```

**No key yet?** Use `scriptedModel` from `@patina-ui/server/testing` to wire up the UI first. It
returns a fixed answer, so you can check rendering, preview, apply, undo and reload before
any model calls:

```ts
import { scriptedModel } from "@patina-ui/server/testing";
const model = scriptedModel(() => ({
  kind: "patch",
  message: "Hid total",
  ops: [
    { op: "setItem", node: "table", prop: "columns", key: "total", field: "hidden", value: true },
  ],
}));
```

## 5. Render it

```tsx
import {
  PatinaProvider,
  PromptInput,
  ProposalPreview,
  ResetButton,
  Surface,
  SurfaceMessage,
  UndoButton,
} from "@patina-ui/react";

<PatinaProvider endpoint="/api/patina">
  <PromptInput surfaceId="orders" />
  <SurfaceMessage surfaceId="orders" />
  <ProposalPreview surfaceId="orders" />
  <UndoButton surfaceId="orders" />
  <ResetButton surfaceId="orders" />
  <Surface id="orders" components={{ OrdersTable }} />
</PatinaProvider>;
```

**An existing page?** Keep its JSX and use `useSlot` / `useCollection` / `useSurfaceProp`
instead of `<Surface>` (see [React](react.md#existing-pages-useslot-usecollection-usesurfaceprop)).
**API on another origin?** `<PatinaProvider credentials="include" params={{ accountId }}>`.

In Next.js, the `@patina-ui/react` bundle is already marked `"use client"`, so you can import
it from a client component.

The primitives are unstyled. Style them with `className`, or use their render-prop form (see
[React](react.md)).

## 6. Check that it works

- [ ] The page renders your table as before (`GET /api/patina/surfaces/orders` returns 200).
- [ ] _"Hide the total column"_ shows a preview: the table changes in place, and the change
      list says _Hide “Total” in Orders table_.
- [ ] **Apply**, then reload: still hidden.
- [ ] Another user (another browser or account) still sees the default.
- [ ] _"Delete all orders"_ or _"show me other customers' orders"_ is refused with a readable
      message.
- [ ] **Undo** and **Reset to default** work.

If something's off:

| Symptom                                          | Likely cause                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 401 from `/api/patina/...`                       | `getContext` returned `null`: your session isn't readable from that request                                 |
| 404 from `/api/patina/...`                       | `basePath` doesn't match where you mounted the handler, or the surface `id` differs from `surfaceId`        |
| `defineSurface(...) is invalid` at startup       | The base spec and manifest disagree. The error lists each problem                                           |
| The table renders, but nothing happens on submit | Check the network tab for a 502 (model unreachable: key, network) or a 429 (rate limit)                     |
| Everything is refused                            | The prompt asks for something the manifest doesn't allow. Add it to the manifest, or check the descriptions |
| A component renders nothing                      | No component registered under that name in `<Surface components={…}>` (a warning is logged)                 |

## 7. Persist it

`memoryStorage()` loses everything on restart. For anything beyond a quick trial, use
Postgres:

```ts
import { Pool } from "pg";
import { migratePostgres, postgresStorage } from "@patina-ui/server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = (sql: string, params?: unknown[]) => pool.query(sql, params);
await migratePostgres(query); // creates Patina's tables if missing

const storage = postgresStorage({ query });
```

Only want saved customizations? `postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })`
needs just `patina_history`. With Drizzle, `export { patinaHistory } from "@patina-ui/server/drizzle"`
in your schema file and generate the migration.

See [Storage](storage.md).

## 8. Let users build views of your data

Install the CLI and scan your app. It finds your GET endpoints and their row types, plus your
UI kit, components and colours:

```sh
npm i -D @patina-ui/cli         # if you skipped it in step 1
npx patina scan                 # writes patina/scan.json, catalog.ts, blocks.tsx
npx patina scan --ai            # optional: Claude refines the drafts (needs ANTHROPIC_API_KEY)
```

Review `patina/catalog.ts`. In particular:

- mark personal fields `sensitive`;
- bind params;
- set `complete` only on endpoints that return every row.

Then register the blocks with `dataBlocks(catalog)` and add `PatinaTable`, `PatinaChart` and
`PatinaStat` to `<Surface components>`. Try _"add a bar chart of … by …"_.
[Data views](data-views.md) walks through it.

## 9. Check every PR

```sh
npx patina init-action          # writes .github/workflows/patina.yml
```

Commit it together with `patina/scan.json`. Every PR then gets a comment when an API or
design change affects your catalog, such as a removed field or a renamed endpoint. See
[GitHub Action](github-action.md).

## 10. Measure it on your surface

Copy `evals/dashboard.jsonl` as a template and write 20–40 prompts your users would
actually type, with the expected ops. Then run them with `runEval` from
`@patina-ui/server/eval` (see [Model and evals](model-and-evals.md)). This tells you
whether your manifest's descriptions and labels are good enough, and which model to use.

## Appendix: trying unreleased changes

To test changes to Patina itself before they're on npm, install tarballs built from this repo:

```sh
# in the patina repo
pnpm install && pnpm pack:local     # writes .packs/patina-ui-{core,server,react,cli}-<version>.tgz
# in your app
npm i /path/to/patina/.packs/patina-ui-{core,server,react}-*.tgz
npm i -D /path/to/patina/.packs/patina-ui-cli-*.tgz
```

The version doesn't change between packs. If your package manager complains about an
integrity mismatch, remove the `@patina-ui/*` entries from its lockfile first.
