<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-wordmark-dark.svg">
    <img src="docs/assets/logo-wordmark.svg" height="40" alt="Patina">
  </picture>
</p>

# Patina

Let the users of your app customize its views in plain language, safely.

A user types _"hide the revenue column, put the appointments table above the chart, and
default the filter to this week"_. Patina previews the change, saves it for that user, and the
view looks that way on every device from then on.

Users can also **compose new views of data your API already exposes**, like _"add a bar
chart of revenue by vet"_. `patina scan` finds your endpoints and design system and generates
data blocks that look like the rest of your app. A GitHub Action flags PRs that break them.

**The model never writes UI code.** It proposes a small declarative patch against a schema
**you** declare: which components a view contains and what about them may change. Every patch
is validated before it is saved, and again whenever it is replayed. Users can preview, undo
and reset. Permissions stay in your app, and you decide per customer, from feature flags or
plans, who gets to customize.

```
packages/core     @patina-ui/core     spec, manifest, patch engine (no dependencies)
packages/react    @patina-ui/react    <Surface> renderer, useSurface, headless UX primitives
packages/server   @patina-ui/server   request handler, Anthropic adapter, storage adapters
packages/cli      @patina-ui/cli      patina scan / check / init-action (data + design detection)
packages/action                    GitHub Action: checks PRs for changes that affect the catalog
examples/demo                      a vet clinic dashboard wired end to end (Express + TanStack Table)
```

> Status: `0.1.0`. Packages are published to npm as `@patina-ui/*` (see
> [Releasing](docs/releasing.md)). To try it in your own app, see
> [Trying Patina in your app](docs/guides/try-in-your-app.md).
> The design is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Using a coding agent?

Give it the Patina UI skill. It covers the rules, the integration steps with working code,
and a verification checklist:

```sh
npx patina init-agent              # Claude Code: installs .claude/skills/patina-ui/SKILL.md
npx patina init-agent --agents-md  # also adds a pointer to AGENTS.md (Codex, Cursor, …)
```

Or paste this into any agent, followed by your task:

```text
Follow https://raw.githubusercontent.com/paulocerez/patina/main/skills/patina-ui/SKILL.md.
Task: make the orders table on /orders customizable (column order, visibility, rows per page).
```

More in [A prompt for coding agents](docs/agent-prompt.md). [`llms.txt`](llms.txt) indexes all
the docs.

## Quick start

From install to a first customizable view in four steps. The full walkthrough is in
[docs/getting-started.md](docs/getting-started.md).

### 1. Install

```sh
npm i @patina-ui/core @patina-ui/server @patina-ui/react @anthropic-ai/sdk
npm i -D @patina-ui/cli        # optional: `patina scan` for data views
```

### 2. Declare a surface (server)

A _surface_ is one customizable view: a base spec (what it looks like by default) plus a
manifest (what users may change).

```ts
// surfaces/orders.ts
import { defineSurface, t } from "@patina-ui/core";

export const orders = defineSurface({
  id: "orders",
  version: 1,
  description: "List of customer orders.",
  base: {
    schemaVersion: 1,
    surfaceId: "orders",
    baseVersion: 1,
    root: "table",
    nodes: {
      table: {
        component: "OrdersTable",
        props: {
          columns: [{ key: "date" }, { key: "customer" }, { key: "total" }, { key: "status" }],
          pageSize: 25,
        },
      },
    },
  },
  labels: { table: "Orders table" },
  components: {
    OrdersTable: {
      description: "One row per order.",
      props: {
        columns: t.collection({
          keys: ["date", "customer", "total", "status"],
          labels: { date: "Date", customer: "Customer", total: "Total", status: "Status" },
          reorder: true,
          hide: true,
        }),
        pageSize: t.int({ min: 10, max: 100 }, { label: "Rows per page" }),
      },
    },
  },
});
```

`defineSurface` throws at startup if the base spec doesn't match the manifest.

### 3. Mount the handler (server)

```ts
// server.ts (Express)
import express from "express";
import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";
import { toExpress } from "@patina-ui/server/express";
import { orders } from "./surfaces/orders";

const patina = createPatinaHandler({
  surfaces: [orders],
  storage: memoryStorage(), // use postgresStorage({ query }) in production
  model: anthropicModel(), // reads ANTHROPIC_API_KEY; never sent to the browser
  basePath: "/api/patina",
  getContext: async (req) => {
    const session = await getSession(req); // your auth
    return session ? { userId: session.userId, tenantId: session.orgId } : null;
  },
});

const app = express();
app.use("/api/patina", toExpress(patina));
```

The handler is a plain `(Request) => Promise<Response>`, so it also mounts directly in
Next.js route handlers, Hono, Bun or Deno.

### 4. Render it (client)

```tsx
import {
  PatinaProvider,
  PromptInput,
  ProposalPreview,
  Surface,
  SurfaceMessage,
  UndoButton,
  ResetButton,
} from "@patina-ui/react";

function OrdersTable({ columns, pageSize }: { columns: { key: string }[]; pageSize: number }) {
  // `columns` arrives ordered, with hidden columns already removed.
  return <MyTable columns={columns.map((c) => c.key)} pageSize={pageSize} />;
}

export function OrdersPage() {
  return (
    <PatinaProvider endpoint="/api/patina">
      <PromptInput surfaceId="orders" />
      <SurfaceMessage surfaceId="orders" />
      <ProposalPreview surfaceId="orders" />
      <UndoButton surfaceId="orders" />
      <ResetButton surfaceId="orders" />
      <Surface id="orders" components={{ OrdersTable }} />
    </PatinaProvider>
  );
}
```

That's it. A user can now type "hide the total column and show 50 rows". They see the change
in place with a list of what will change, then apply it, and it persists.

All UI primitives are unstyled. Each one also takes a render-prop child for full control over
the markup (see the demo's `Customizer`).

## Run the demo

```sh
pnpm install
pnpm demo                     # API on :3001, app on http://localhost:5173
```

Without `ANTHROPIC_API_KEY`, the demo uses a small offline keyword model so you can try the
flow. Set the key (and optionally `PATINA_MODEL`) to use Claude. Switch between Alice
(finance access) and Bob (no finance access) in the header: Bob never sees revenue, in the
view or in the model's prompt.

## Docs

- [Getting started](docs/getting-started.md): the demo, step by step
- [Trying Patina in your app](docs/guides/try-in-your-app.md): install from tarballs, wire up, checklist
- Guides:
  - [Defining a surface](docs/guides/define-a-surface.md)
  - [Type reference](docs/guides/types.md)
  - [Server setup](docs/guides/server-setup.md)
  - [Storage](docs/guides/storage.md): memory and Postgres, plus prompt retention
  - [React](docs/guides/react.md)
  - [Permissions and safety](docs/guides/permissions-and-safety.md)
  - [Evolving base views](docs/guides/evolving-base-views.md)
  - [Model and evals](docs/guides/model-and-evals.md)
  - [Data views](docs/guides/data-views.md): `patina scan`, the catalog, data blocks
  - [GitHub Action](docs/guides/github-action.md): check every PR
  - [Availability](docs/guides/availability.md): who may customize, from feature flags, plans and quotas
  - [Insights](docs/guides/insights.md): what customers asked for, what couldn't be done, and why
  - [Follow-ups](docs/guides/follow-ups.md): Linear issues and a Slack digest from what customers asked for
  - [Localization](docs/guides/localization.md): English and German, labels per language
- [API reference](docs/reference/README.md) (generated with `pnpm docs:api`)
- [A prompt for coding agents](docs/agent-prompt.md): `npx patina init-agent` installs the skill
  ([`skills/patina-ui/SKILL.md`](skills/patina-ui/SKILL.md)); [`llms.txt`](llms.txt) indexes the docs
- [Releasing](docs/releasing.md): npm publishing with Changesets
- [ARCHITECTURE.md](ARCHITECTURE.md): the design and its tradeoffs

## Development

```sh
pnpm test        # unit + property tests for all packages
pnpm typecheck
pnpm lint        # Biome
pnpm build
pnpm eval --model offline   # eval set, free baseline; drop --model for Claude
pnpm docs:api               # regenerate docs/reference
pnpm pack:local             # tarballs for trying it in another app
```
