# Patina: architecture

> Status: **signed off and implemented** (`0.1.0`, published as `@patina-ui/*`). See §14 for what is
> deferred. Where the code and this document differ, the code wins and this document should
> be updated.

Patina is a library that host applications import so their end users can customize chosen
views in plain language. A user types _"hide the revenue column, put the appointments table
above the chart, and default the filter to this week"_. The view changes, and the change
follows that user across sessions and devices.

**The model never writes UI code.** It returns a small declarative **patch** against a
**spec** whose shape the host has fixed in a **capability manifest**. Every patch is
validated before it is stored and validated again before it is rendered. The view a user sees
is always `base spec + stored patches`, so every customization can be inspected, undone and
safely replayed.

---

## 1. Packages and boundaries

```
packages/
  core/     @patina-ui/core    types, the t.* DSL, spec, manifest, patch engine, resolver, migrations
  react/    @patina-ui/react   PatinaProvider, useSurface, <Surface> renderer, headless UX primitives
  server/   @patina-ui/server  request handler, ModelAdapter (+ Anthropic), StorageAdapter (+ memory, Postgres)
examples/
  demo/                     Vite + React dashboard (filter bar, stat cards, chart, TanStack Table) and an Express server
evals/                      prompt → expected-patch cases and a runner script
```

| Package  | May depend on                                                              | Must not depend on                     |
| -------- | -------------------------------------------------------------------------- | -------------------------------------- |
| `core`   | nothing (zero runtime deps)                                                | React, DOM, any LLM SDK, any DB driver |
| `react`  | `core`, `react`                                                            | LLM SDKs, DB drivers                   |
| `server` | `core`, the LLM SDK (only in its adapter entry point), nothing DB-specific | React                                  |

The Postgres adapter takes a `query(sql, params)` function instead of importing a driver, so
`server` has no hard database dependency (see §7).

### Tech stack

| Layer           | Choice                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript (strict), ESM-only. Node 20+ on the server                                                                                                                                 |
| Monorepo        | pnpm workspaces                                                                                                                                                                       |
| Package build   | tsup (ESM + `.d.ts`)                                                                                                                                                                  |
| `core`          | No runtime dependencies. Its own `t.*` DSL produces validators and JSON Schema                                                                                                        |
| `react`         | React 18 and 19 as a peer dependency. Headless, no styling library                                                                                                                    |
| `server`        | Fetch-style handler (`(Request) => Promise<Response>`). `@patina-ui/server/express` exports `toExpress(handler)`. `@anthropic-ai/sdk` is loaded only by `@patina-ui/server/anthropic` |
| Model           | Anthropic structured outputs. Default: Haiku 5.5 answers, Sonnet 5.5 handles retries (low effort)                                                                                     |
| Storage         | Postgres through an injected `query(sql, params)`: `pg`, `postgres.js` or PGlite                                                                                                      |
| Tests           | Vitest, fast-check, Testing Library, PGlite                                                                                                                                           |
| Evals           | A `tsx` script over `evals/*.jsonl` (`pnpm eval --model …`)                                                                                                                           |
| Lint and format | Biome                                                                                                                                                                                 |
| Demo client     | Vite + React. **TanStack Table** for the appointments table, Recharts for the chart                                                                                                   |
| Demo server     | **Express**. `memoryStorage` by default, PGlite optional                                                                                                                              |
| Releases and CI | Changesets, GitHub Actions                                                                                                                                                            |

TanStack Table is used only inside the demo's `DataTable` component. Patina's resolved
`columns` collection maps directly onto TanStack's `columnOrder` and `columnVisibility`
state. This also shows that host components need no Patina-specific code.
`@patina-ui/react` itself doesn't depend on TanStack.

### Request flow

```
 browser (@patina-ui/react)                         host server (@patina-ui/server)
 ───────────────────────                         ────────────────────────────
 GET  /surfaces/:id  ───────────────────────────▶ getContext(req) → {userId, tenantId, perms}
                                                  load layers → resolve() → resolved spec
 ◀──────────────── resolved spec + skip report ─

 user types prompt
 POST /surfaces/:id/proposals {prompt} ─────────▶ restrict manifest to ctx
                                                  model.propose(manifest, structural spec, prompt)
                                                  validate(patch) ─┬─ invalid → readable refusal
                                                                   └─ valid   → store proposal (TTL)
 ◀──── {proposalId, ops, changes[], summary} ────
 render apply(resolved, ops) as the preview
 user clicks Apply
 POST /surfaces/:id/proposals/:pid/commit ──────▶ re-validate against the current head → append
 ◀───────────────────────── new resolved spec ──
```

---

## 2. The spec format

A spec is a **normalized map of nodes with stable IDs** assigned by the host. Each node names a
registered component and holds its props. Layout is also a prop: a _slot_ is a prop whose value
is an ordered list of child node references.

```ts
interface SurfaceSpec {
  schemaVersion: 1; // Patina's own format version
  surfaceId: string; // "clinic.dashboard"
  baseVersion: number; // host's version of this base view, increases monotonically
  root: NodeId;
  nodes: Record<NodeId, { component: string; props: Record<string, Value> }>;
}

// Every ordered thing (slot children, table columns, chart series) is a keyed collection.
type Collection<T = {}> = Array<{ key: string; hidden?: boolean } & T>;
```

**Ordered keyed collections are the only ordering primitive.** Slot children are keyed by node
ID, and columns are keyed by column key. Patches always address items by key, never by array
index. Index-based patches break as soon as the host adds a column. Key-based ones survive.

**State values are semantic, not resolved.** A default filter of "this week" is stored as
`{ "relative": "thisWeek" }`, never as two dates, so it stays correct next week.

### Example: the demo dashboard base spec

```json
{
  "schemaVersion": 1,
  "surfaceId": "clinic.dashboard",
  "baseVersion": 1,
  "root": "page",
  "nodes": {
    "page": {
      "component": "DashboardLayout",
      "props": {
        "main": [
          { "key": "filters" },
          { "key": "kpis" },
          { "key": "revenue-chart" },
          { "key": "appointments" }
        ]
      }
    },
    "filters": {
      "component": "FilterBar",
      "props": { "dateRange": { "relative": "last30Days" }, "status": "all" }
    },
    "kpis": {
      "component": "StatRow",
      "props": { "cards": [{ "key": "stat-visits" }, { "key": "stat-revenue" }] }
    },
    "stat-visits": { "component": "StatCard", "props": { "metric": "visits" } },
    "stat-revenue": { "component": "StatCard", "props": { "metric": "revenue" } },
    "revenue-chart": {
      "component": "Chart",
      "props": { "kind": "line", "metric": "revenue", "groupBy": "week" }
    },
    "appointments": {
      "component": "DataTable",
      "props": {
        "columns": [
          { "key": "date" },
          { "key": "patient" },
          { "key": "vet" },
          { "key": "status" },
          { "key": "revenue" }
        ],
        "sort": { "key": "date", "dir": "desc" },
        "pageSize": 25,
        "density": "comfortable"
      }
    }
  }
}
```

The spec does **not** contain data or display copy. Column labels, metric names and the rows
themselves come from host code at render time. The spec only says _which_ of the
host-provided things are shown, _in what order_ and _with which presentation options_.

---

## 3. The capability manifest

Host developers describe each surface with `defineSurface`. The manifest declares the
components on the surface, which of their props can be customized, the type and constraints of
each such prop, and descriptions written for the model.

Prop types come from a **small, closed type DSL in core** (`t.*`). It compiles to two things:
runtime validators, and the JSON Schema used for structured model output. The DSL deliberately
has **no URL, HTML, CSS, script or free-form-object type**, so a manifest cannot open those
doors even by mistake.

| Type                                          | Example                          | Notes                                                                                       |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `t.enum(values)`                              | `t.enum(["line","bar"])`         | Values may be computed per request (§9)                                                     |
| `t.int({min,max})`, `t.bool()`                | `t.int({min:10,max:100})`        |                                                                                             |
| `t.label({maxLen})`                           | user-facing title text           | Plain text only, control characters stripped, always rendered as a text node                |
| `t.relativeDateRange(allowed)`                | `{ relative: "thisWeek" }`       | Semantic, never absolute                                                                    |
| `t.sort(keys)`                                | `{ key, dir }`                   |                                                                                             |
| `t.object({...})`                             | fixed shape built from the above | No index signatures                                                                         |
| `t.collection({ keys, reorder, hide, item })` | table columns                    | Keys are fixed by the host. Items can be reordered, hidden and have their `item` fields set |
| `t.slot({ accepts, reorder, hide, insert })`  | page layout                      | A collection of child nodes. `insert` lists **preset IDs**, never raw components            |

### Example: the demo manifest

```ts
import { defineSurface, t } from "@patina-ui/core";
import baseSpec from "./dashboard.base.json";

const COLUMN_KEYS = ["date", "patient", "vet", "status", "revenue"];

export const dashboard = defineSurface({
  id: "clinic.dashboard",
  version: 1,
  base: baseSpec,
  description: "Clinic overview dashboard: appointments, visits and revenue.",

  components: {
    DashboardLayout: {
      description: "The page. Sections in `main` render top to bottom.",
      props: {
        main: t.slot({
          accepts: ["FilterBar", "StatRow", "Chart", "DataTable"],
          reorder: true,
          hide: true,
          insert: [],
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
    FilterBar: {
      description: "Filters that apply to every section on the page.",
      props: {
        dateRange: t.relativeDateRange([
          "today",
          "thisWeek",
          "thisMonth",
          "last30Days",
          "last90Days",
        ]),
        status: t.enum(["all", "scheduled", "completed", "cancelled"]),
      },
    },
    Chart: {
      description: "Time-series chart of one metric.",
      props: {
        kind: t.enum(["line", "bar"]),
        groupBy: t.enum(["day", "week", "month"]),
        // `metric` is deliberately not listed, so it cannot be customized.
      },
    },
    DataTable: {
      description: "Appointments table. One row per appointment.",
      props: {
        columns: t.collection({
          keys: COLUMN_KEYS,
          reorder: true,
          hide: true,
          item: { label: t.label({ maxLen: 40 }) },
        }),
        sort: t.sort(COLUMN_KEYS),
        pageSize: t.int({ min: 10, max: 100 }),
        density: t.enum(["compact", "comfortable"]),
      },
    },
  },

  // The only things a user can add. Hosts own what these render.
  presets: {
    "stat.noShows": {
      description: "KPI card: number of no-show appointments.",
      node: { component: "StatCard", props: { metric: "noShows" } },
    },
  },

  // Narrow the manifest to what this user may see (§9).
  // Returns what to take away for this request: { keys?, nodes?, presets? }.
  restrict: (ctx) =>
    ctx.permissions.includes("finance.read")
      ? {}
      : { keys: ["revenue"], nodes: ["stat-revenue", "revenue-chart"] },

  migrations: {}, // §6
});
```

Props that the manifest does not list keep their base values and cannot be targeted by a patch.

---

## 4. The patch format

```ts
interface Patch {
  id: string;
  schemaVersion: 1;
  baseVersion: number; // the base version the patch was authored against
  ops: Op[];
  summary?: string; // the model's one-liner. Informational only (see §8)
}

type Path =
  | [prop: string] // a whole prop: ["pageSize"]
  | [prop: string, itemKey: string, field: string]; // a collection item field: ["columns","revenue","hidden"]

type Anchor = { before: string } | { after: string } | "start" | "end";

type Op =
  | { op: "set"; node: NodeId; path: Path; value: Value }
  | { op: "move"; node: NodeId; prop: string; key: string; to: Anchor }
  | { op: "insert"; node: NodeId; prop: string; preset: string; key: string; to: Anchor }
  | { op: "remove"; node: NodeId; prop: string; key: string };
```

- **Hide and show are just `set ... hidden`.** This works the same way for page sections, stat
  cards and columns.
- **`remove` applies only to items a user inserted** (keys with the `u_` prefix, generated by
  the engine). Base items can be hidden but never removed. This keeps base evolution simple
  and makes reset trivial.
- **`insert` names a preset, not a component.** The engine materializes the preset's node
  under the new key.

### Example: the prompt from the brief

> "hide the revenue column, put the appointments table above the chart, and default the filter to this week"

```json
{
  "id": "p_01JD8Z…",
  "schemaVersion": 1,
  "baseVersion": 1,
  "summary": "Hid Revenue, moved Appointments above the chart, set the date filter to this week.",
  "ops": [
    {
      "op": "set",
      "node": "appointments",
      "path": ["columns", "revenue", "hidden"],
      "value": true
    },
    {
      "op": "move",
      "node": "page",
      "prop": "main",
      "key": "appointments",
      "to": { "before": "revenue-chart" }
    },
    { "op": "set", "node": "filters", "path": ["dateRange"], "value": { "relative": "thisWeek" } }
  ]
}
```

Applied to the §2 base, the page's `main` becomes `filters, kpis, appointments, revenue-chart`.
Its inverse, computed against the base, is:

```json
[
  { "op": "set", "node": "filters", "path": ["dateRange"], "value": { "relative": "last30Days" } },
  {
    "op": "move",
    "node": "page",
    "prop": "main",
    "key": "appointments",
    "to": { "after": "revenue-chart" }
  },
  { "op": "set", "node": "appointments", "path": ["columns", "revenue", "hidden"], "value": null }
]
```

(`null` means "back to the default", here: no `hidden` flag at all. The inverse ops are
listed in reverse order. A `move` inverse anchors to the item's original
previous sibling, or uses `"start"` if there was none.)

### Engine API (`@patina-ui/core`, pure and deterministic)

```ts
validate(manifest, spec, patch): Issue[]
// Issue = { opIndex, code, message }. `message` is written for end users:
//   "“Delete button” isn't something you can add here. You can add: No-shows card."

apply(spec, patch, { mode: "strict" | "tolerant" }): { spec, applied: Op[], skipped: Skip[] }
// strict   (authoring/commit): any invalid op → the whole patch is rejected
// tolerant (replay):           invalid ops are skipped and reported, never thrown

invert(specBefore, patch): Patch           // apply(apply(s,p), invert(s,p)) ≡ s
compose(a, b): Patch                       // apply(s, compose(a,b)) ≡ apply(apply(s,a), b)
                                           // collapses repeated sets on one path, cancels insert+remove
describe(manifest, specBefore, patch): Change[]   // deterministic, human-readable diff for the preview
```

**Testing commitments.** We generate random valid specs and patches from a manifest with
fast-check and check these properties:

- invert round-trip
- compose ≡ sequential apply
- compose associativity
- `apply` never throws in tolerant mode, even for arbitrary JSON patches
- `validate` passes ⇒ strict `apply` succeeds

Example-based tests cover each op and each error code.

---

## 5. Resolution order

```
resolved = base(surface, current version)
         ▷ tenant layer   (ordered patches, tolerant)      ← designed now, not built in v1 UI
         ▷ user layer     (ordered patches, tolerant)
```

```ts
function resolve(manifest, layers: Layer[]): { spec: SurfaceSpec; skipped: Skip[] } {
  let spec = manifest.base;
  const skipped = [];
  for (const layer of layers) {
    // ["tenant", "user"]
    for (const patch of effectivePatches(layer)) {
      // after the last reset, minus reverted (§7)
      const migrated = migratePatch(manifest, patch); // §6
      const r = apply(spec, migrated, { mode: "tolerant" });
      spec = r.spec;
      skipped.push(...r.skipped.map((s) => ({ ...s, layer: layer.name, patchId: patch.id })));
    }
  }
  return { spec: restrictSpec(manifest, ctx, spec), skipped };
}
```

- When layers conflict, the later layer wins, because it is applied later. A user who moved a
  column keeps that order even if the tenant later changes theirs. That is an intentional
  user override. Tenant **locks** are reserved for later (§12).
- The resolved spec is cached by `(surfaceId, baseVersion, tenantHeadSeq, userHeadSeq)`.
  Resolution is pure, so the cache can never be wrong, only cold.

---

## 6. Base view evolution and migrations

There are two independent version numbers:

| Version         | Owned by | Changes when                       | Migrated by                                            |
| --------------- | -------- | ---------------------------------- | ------------------------------------------------------ |
| `schemaVersion` | Patina   | the spec or patch _format_ changes | Patina, automatically, on read                         |
| `baseVersion`   | host     | the host ships a new base view     | host-supplied `migrations` hooks, then tolerant replay |

```ts
import { migrations as m } from "@patina-ui/core";

migrations: {
  // runs on ops from patches authored at baseVersion < 2
  2: [
    m.renameProp("DataTable", "pageSize", "rowsPerPage"),
    m.renameKey("appointments", "columns", "vet", "doctor"),
    m.renameNode("revenue-chart", "revenue-trend"),
    // or any (op: Op, spec: SurfaceSpec) => Op | null   (null = drop the op deliberately)
  ],
}
```

On replay, each patch's ops pass through every migration step between `patch.baseVersion` and
the current version. Then they are applied in **tolerant** mode. Anything that still doesn't
fit (the target node is gone, an anchor key was removed, a value is now out of range) is
skipped with a reason. The view never crashes. `GET /surfaces/:id` returns the skip report, so
the UI can say _"2 of your earlier changes no longer apply"_ and list them.

Stored patches are never rewritten. Migration happens on read, so if a migration hook has a bug,
fixing the hook fixes every user.

---

## 7. Persistence

### Adapter interface

```ts
interface HistoryKey {
  tenantId: string | null;
  layer: "user" | "tenant";
  subjectId: string; // userId for the user layer, tenantId for the tenant layer
  surfaceId: string;
}

type Entry =
  | {
      kind: "patch";
      id: string;
      seq: number;
      patch: Patch;
      prompt: string;
      model: string;
      createdAt: Date;
    }
  | { kind: "revert"; id: string; seq: number; targetId: string; createdAt: Date } // undo
  | { kind: "reset"; id: string; seq: number; createdAt: Date }; // reset to default

interface StorageAdapter {
  list(key: HistoryKey): Promise<Entry[]>; // ordered by seq
  append(key: HistoryKey, entry: NewEntry, expectedSeq: number): Promise<Entry>; // throws Conflict if head moved
  saveProposal(p: Proposal, ttlSeconds: number): Promise<void>;
  takeProposal(id: string, key: HistoryKey): Promise<Proposal | null>; // single use, scoped to the key
}
```

The history is **fully append-only**. Undo appends a `revert` entry, and reset appends a `reset`
entry, so either can itself be reverted ("undo reset"). The effective patches are the
non-reverted `patch` entries after the last non-reverted `reset`. `expectedSeq` gives
optimistic concurrency between devices. On conflict the server reloads and re-validates the
proposal against the new head. If it is still valid, it is appended without bothering the user.

Ship two adapters: `memoryStorage()` (for tests and the demo) and
`postgresStorage({ query })`.

### Postgres schema

```sql
create table patina_history (
  id             text        primary key,
  tenant_id      text        not null default '',   -- '' = no tenant
  layer          text        not null check (layer in ('user','tenant')),
  subject_id     text        not null,
  surface_id     text        not null,
  seq            integer     not null,
  kind           text        not null check (kind in ('patch','revert','reset')),
  target_id      text        null references patina_history(id),   -- for kind = 'revert'
  schema_version integer     null,
  base_version   integer     null,
  ops            jsonb       null,
  prompt         text        null,                  -- original user prompt (retention: §12)
  summary        text        null,
  model          text        null,                  -- e.g. 'anthropic/claude-opus-5-5'
  created_at     timestamptz not null default now(),
  unique (tenant_id, layer, subject_id, surface_id, seq)
);

create table patina_proposals (
  id          text        primary key,
  tenant_id   text        not null default '',
  subject_id  text        not null,
  surface_id  text        not null,
  base_seq    integer     not null,     -- user head at propose time
  patch       jsonb       not null,
  prompt      text        not null,
  model       text        not null,
  expires_at  timestamptz not null
);
```

Example row, for the patch from §4:

| id        | tenant_id   | layer  | subject_id | surface_id         | seq | kind    | base_version | ops                  | prompt                          |
| --------- | ----------- | ------ | ---------- | ------------------ | --- | ------- | ------------ | -------------------- | ------------------------------- |
| `h_01JD…` | `clinic-42` | `user` | `u_981`    | `clinic.dashboard` | `3` | `patch` | `1`          | `[{"op":"set",…},…]` | `hide the revenue column, put…` |

The adapter accepts any `query(sql: string, params: unknown[]) => Promise<{ rows }>`. That
covers `pg`, `postgres.js` (through a two-line shim) and PGlite. The adapter's tests run on
**PGlite**, in process, with no Docker. Migrations ship as plain SQL files plus a
`migrate(query)` helper.

---

## 8. Server: handler and model adapter

### Handler

```ts
import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";

export const patina = createPatinaHandler({
  surfaces: [dashboard],
  storage: memoryStorage(),
  model: anthropicModel() // Haiku 5.5, Sonnet 5.5 as backup; reads ANTHROPIC_API_KEY,
  getContext: async (req) => {
    // identity ALWAYS comes from the host's session
    const s = await getSession(req);
    return { userId: s.userId, tenantId: s.orgId, permissions: s.permissions };
  },
  limits: { promptMaxChars: 500, proposalsPerMinute: 10 },
});
// The handler is (req: Request) => Promise<Response>. Mount it at /api/patina/* in Next or Hono,
// or in Express (the demo's setup):
//   import { toExpress } from "@patina-ui/server/express";
//   app.use("/api/patina", toExpress(patina));
```

| Route                                       | Does                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET  /surfaces/:id`                        | Resolve and return `{ spec, skipped, canUndo, isCustomized, render }` (`render` says which props are slots/collections)                                                                                    |
| `POST /surfaces/:id/proposals` `{ prompt }` | Call the model, validate strictly, store the proposal and return `{ kind: "proposal", proposalId, ops, changes, summary, previewSpec }`, `{ kind: "refusal", message }` or `{ kind: "clarify", question }` |
| `POST /surfaces/:id/proposals/:pid/commit`  | `takeProposal`, re-validate against the current head, append, return the new resolved spec                                                                                                                 |
| `POST /surfaces/:id/undo`                   | Append `revert` for the latest effective entry                                                                                                                                                             |
| `POST /surfaces/:id/reset`                  | Append `reset`                                                                                                                                                                                             |

Commit takes a **proposal ID, not a patch from the client**. What gets stored is exactly what
the server validated and the user previewed, and a tampered client can't commit arbitrary ops.
Body fields never carry `userId`, `tenantId` or `surfaceId` overrides.

### Model adapter

```ts
interface ModelAdapter {
  readonly id: string; // "anthropic/claude-opus-5-5"
  // Built by core's buildModelRequest():
  //   system:       rules + manifest descriptions (identical across users: cacheable)
  //   user:         <current_view> structural spec (IDs, keys, labels, settings) + <request>
  //   outputSchema: compiled from the *restricted* manifest
  // Returns the raw JSON answer: { kind: "patch" | "refusal" | "clarify", message, ops }.
  propose(request: { system: string; user: string; outputSchema: JSONSchema }): Promise<unknown>;
}
// core's fromModelOutput() turns the answer into a ModelResult; the ops are then validated.
```

The concrete adapter is **Anthropic**, using structured outputs with the manifest-derived JSON
Schema. In the schema, ops are flattened (`set`, `setItem`, `move`/`insert` with
`position` + `anchor`) to stay inside the JSON Schema subset structured outputs support, and
insert keys are generated by the server, never by the model. The schema is precise: `node` is an enum of node IDs, `path` is constrained per component, and
values are constrained per prop. Most invalid patches are therefore impossible to emit, not
merely rejected. If validation still fails, the adapter makes **one repair round-trip**,
sending the validator's issues back to the model. After that, the request becomes a refusal
with the validator's message.

**Measured (2026-11-27).** For the demo dashboard, the API refused to compile the precise
schema ("compiled grammar is too large"). The adapter therefore also has a **compact**
schema: a single op shape, node and prop as enums, values as JSON text, with each prop's
allowed values written into the system prompt. It falls back to it automatically. With the
compact schema, the eval set scores 58/58 (Opus 5.5 and Sonnet 5.5) and 57/58 (Haiku 5.5 alone);
the default, Haiku 5.5 with Sonnet 5.5 as backup and two prompt rules added, scored 58/58 in
three runs out of three,
at a p50 latency of 1.4–1.8 s (see docs/guides/model-and-evals.md).

**Prompt construction**

- The model sees the restricted manifest, the **structural** spec (IDs, keys, host labels,
  current prop values) and the user's prompt. **It never receives row data or other contents
  of the view.**
- Host labels and user-set `t.label` values are placed inside a clearly delimited block that is
  marked as untrusted data, not instructions.
- Even a successful prompt injection is bounded by the manifest. It can only produce a patch
  the user could have asked for themselves, and the user still has to preview and confirm it.

**The preview the user confirms is computed by core** (`describe()` over the actual ops), not
taken from the model's `summary`. The model can't misdescribe what it is about to do.

---

## 9. Safety model

**Customization affects presentation only.** Patina chooses among things the host already
renders for this user. It never fetches data, never calls actions and never defines components.

1. **Restriction per request.** `restrict(ctx, manifest)` removes keys, nodes and presets the
   user isn't entitled to. The restricted manifest drives the model schema, validation and
   `restrictSpec` in the resolver. A forbidden column is therefore invisible to the model,
   cannot be targeted and cannot be rendered.
2. **The host's data layer is still the authority.** Even if something slipped through, a spec
   that says "show `revenue`" grants no data. The host's query and its permission checks decide
   what reaches the component. The demo shows this pattern explicitly.
3. **A closed value space.** The `t.*` DSL has no URL, HTML, CSS, script or open-object type. The
   renderer passes values only as props to host components, and `t.label` is rendered as text.
   Patina contains no `eval`, no `new Function` and no `dangerouslySetInnerHTML`.
4. **Validation happens at propose, at commit and at render** (tolerant resolve). Stored data
   is never trusted, even our own.
5. **Readable refusals.** A request the manifest can't express is refused in one of two ways:
   - The model returns `refusal`. Example: _"show me other users' data"_ → _"I can only change
     how this dashboard is laid out and filtered, not what data you have access to."_
   - Validation rejects the patch. Example: _"add a delete button"_ → _"A delete button isn't
     something you can add here. You can add: No-shows card."_

   Both paths have tests. The model-refusal path is tested with a scripted fake adapter and in
   the eval set. The validation path is tested deterministically in core.
6. **Keys never reach the browser.** The model is called only from the server handler.

---

## 10. React bindings and headless UX

```tsx
<PatinaProvider endpoint="/api/patina">
  <Surface
    id="clinic.dashboard"
    components={{ DashboardLayout, FilterBar, StatRow, StatCard, Chart, DataTable }}
  />
  <Customizer surfaceId="clinic.dashboard" /> {/* host-built, from the primitives below */}
</PatinaProvider>;
```

- **`<Surface>`** renders the resolved spec, or the **proposal preview** while one is pending,
  as `apply(resolved, proposal)`. Host components receive plain props:
  - Slot props arrive as ordered, already-filtered `ReactNode[]`.
  - Collection props arrive as ordered arrays with hidden items removed.

  A host component therefore needs no Patina knowledge. `DataTable` just gets
  `columns=[{key:"date"},…]`.
- **`useSurface(id)`** → `{ spec, status, proposal, refusal, skipped, propose(prompt), commit(),
  discard(), undo(), reset(), canUndo, isCustomized }`.
- **Headless primitives.** They are render-prop or `asChild`, carry no styles and wire up ARIA
  and keyboard handling:
  - `PromptInput`
  - `ProposalPreview` (a list of `changes` from `describe()`, plus Apply and Discard)
  - `SurfaceMessage` (refusals, clarifying questions, errors)
  - `UndoButton`
  - `ResetButton`
  - `SkippedNotice`

---

## 11. Evals and testing

- **`core`** has unit tests and fast-check property tests (§4). Coverage targets the engine
  and the validator, which are the security boundary.
- **`server`** has handler tests against `memoryStorage` and a scripted fake `ModelAdapter`:
  - propose, preview and commit
  - tampering (an unknown, expired or foreign proposal ID)
  - refusals
  - concurrency conflicts
  - reload after a base-version bump

  The Postgres adapter runs the **same adapter contract suite** on PGlite.
- **`react`** has Testing Library tests for the preview, commit, undo and reset flows.
- **Eval set:** `evals/dashboard.jsonl`, run with `pnpm eval [--model claude-sonnet-5-5]`.

  ```json
  {"id":"cols-01","surface":"clinic.dashboard","history":[],"prompt":"hide revenue and put status right after date","expect":{"kind":"patch","ops":[{"op":"set","node":"appointments","path":["columns","revenue","hidden"],"value":true},{"op":"move","node":"appointments","prop":"columns","key":"status","to":{"after":"date"}}]}}
  {"id":"refuse-01","surface":"clinic.dashboard","prompt":"show me other users' appointments","expect":{"kind":"refusal"}}
  ```

  Scoring **compares resolved specs, not op lists**. Both the expected ops and the model's ops
  are applied to the same starting spec and the results are compared, so equivalent patches
  (`after: date` vs `before: patient`) both pass. The runner reports:
  - exact-match accuracy
  - refusal precision and recall
  - the repair-retry rate
  - p50/p95 latency
  - tokens per case

  The aim is 40–60 cases at first, covering columns, layout, filters, sorting, presets,
  ambiguity and refusals.

---

## 12. Open questions and tradeoffs

| #   | Question                                      | Options                                                  | Recommendation                                                                                                                                                                                                                      |
| --- | --------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How are columns modeled?                      | (a) child nodes, (b) keyed collections inside props      | **(b)**. Fewer registered components, and slots and columns share one mechanism.                                                                                                                                                    |
| 2   | Can users remove base items?                  | remove vs hide-only                                      | **Hide only.** Removing a base item makes base evolution and reset ambiguous.                                                                                                                                                       |
| 3   | How does undo work?                           | (a) append an inverse patch, (b) append a `revert` entry | **(b)**. The history stays append-only and readable ("undid X"), and undo-of-reset comes free. `invert` is still used for in-memory preview and tests.                                                                              |
| 4   | How atomic is replay?                         | per patch vs per op                                      | **Authoring is per patch (strict). Replay is per op (tolerant).** A partially applicable old patch is better than losing all of it. Each skip is reported.                                                                          |
| 5   | Type system                                   | own DSL vs zod / valibot                                 | **Own small DSL.** The closed set _is_ the safety property, it has no dependencies, and it emits exactly the JSON Schema subset that structured outputs support.                                                                    |
| 6   | What does commit send?                        | the client sends the patch vs a server-held proposal ID  | **Proposal ID.** It cannot be tampered with, and what the user previewed is what gets stored.                                                                                                                                       |
| 7   | Does the model see view data?                 | none / labels only / sample rows                         | **Structure and host labels only.** This rules out data-borne injection and data leaking to the provider. Revisit only if evals show a real need (e.g. "hide the empty columns").                                                   |
| 8   | Clarifying questions                          | single-shot vs multi-turn                                | Keep **`clarify`** in the result type now and render it as a message in the UI. Multi-turn comes later.                                                                                                                             |
| 9   | History growth                                | unbounded vs compaction                                  | Compact after N (≈50) effective patches: `compose` them into a single snapshot entry and keep the prompts as an audit trail. Not needed for v1.                                                                                     |
| 10  | Tenant layer vs user overrides                | user always wins vs tenant locks                         | The user wins by default. Reserve a `locked` flag on tenant-layer ops for later. The schema and resolver already support layers.                                                                                                    |
| 11  | Retention of stored prompts (may contain PII) | keep forever vs a TTL                                    | `storage.redactPrompts(before)`, run from a host job, nulls old prompts. Default: keep.                                                                                                                                             |
| 12  | Default model                                 | Opus, Sonnet or Haiku, or a pair                         | **Decided:** Haiku 5.5 answers; Sonnet 5.5 takes the repair round-trip and any errors or safety declines (`withBackup`). It is the fastest and cheapest, and it scored 58/58 in 3 of 3 eval runs. Hosts can pick any model or pair. |
| 13  | Version numbers                               | semver strings vs integers                               | **Integers** for `baseVersion`. Migrations need a total order, and semver adds nothing here.                                                                                                                                        |
| 14  | Preview location                              | in place vs side-by-side                                 | **In place** (the live surface shows the proposal) with a change list. Simpler, and it shows the real result.                                                                                                                       |

### Keeping out-of-scope features unblocked

- **New components.** These become new presets or registered components on the host side. The
  patch format already has `insert`. §15 proposes configurable data-bound blocks.
- **Prompt-driven theming.** This would be a new closed type (`t.token(["brand","muted",…])`)
  that maps to design tokens. It would never be raw CSS. Nothing in the format prevents it.
- **Sharing customizations.** A `HistoryKey` can point at a "shared" subject, and copying is
  just re-validating and appending patches. Ops are key-addressed, so they transfer.
- **Real-time collaboration.** The history is already an ordered op log with sequence numbers
  and optimistic concurrency. Broadcasting appends is additive.

---

## 13. Documentation

The docs are Markdown in the repo, so GitHub renders them with no extra tooling. They are
versioned with the code, and a PR that changes an API changes its docs in the same diff.

```
README.md                       What Patina is, plus a quick start: install → first customizable view in ~10 minutes
docs/
  getting-started.md            Full walkthrough, mirroring examples/demo step by step
  guides/
    define-a-surface.md         Base spec, manifest, choosing what to open up
    types.md                    The t.* DSL reference with examples
    server-setup.md             The handler, getContext, Express / Next / Hono mounting, limits
    storage.md                  memoryStorage, postgresStorage, running the SQL migrations
    react.md                    <Surface>, useSurface, building a customizer from the primitives
    permissions-and-safety.md   restrict(), what Patina does and doesn't enforce, the host's responsibilities
    evolving-base-views.md      Bumping baseVersion, migration helpers, skip reports
    model-and-evals.md          Choosing a model, writing eval cases, reading the eval report
  reference/                    API reference generated from TSDoc (TypeDoc + typedoc-plugin-markdown)
ARCHITECTURE.md                 This document: the why, for contributors
```

- **Code samples stay honest.** The README quick start also exists as a runnable app,
  `examples/quickstart`. CI type-checks it together with the demo, and fails if the generated
  API reference is out of date. The quick start was also verified by installing the packed
  tarballs into a fresh Vite + Express app.
- **The docs are written with the code, not afterwards.** The vertical slice ships with
  `README.md`, `getting-started.md`, `define-a-surface.md` and `server-setup.md`. Each later
  feature adds or updates its guide in the same PR.
- **A docs site comes later if needed.** If Patina is published publicly, the same `docs/`
  folder can be served by VitePress on GitHub Pages without being rewritten. Pages on a
  private repo needs a paid GitHub plan. Until then, the files rendered on GitHub are enough.

## 14. Implementation status

Everything in this document is implemented, except:

- **History compaction (§12 #9).** It is deferred: with an append-only log, a squashed
  snapshot interacts badly with undo (undoing it would revert many changes at once). Replay
  is cheap at expected history sizes. Revisit it with real data, together with a `snapshot`
  entry kind.
- **Tenant-layer writes and `locked` props (§12 #10).** The tenant layer is read and applied,
  but there's no API to write it yet.
- **Multi-turn clarification (§12 #8).** `clarify` answers are shown as messages, and each
  prompt is a fresh request.

Where things live:

| Piece                                                                                 | Location                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Spec, DSL, engine, resolution, migrations, model schema and prompt                    | `packages/core`                                         |
| Handler, Anthropic adapter, memory and Postgres storage, Express adapter, eval runner | `packages/server`                                       |
| Renderer, hooks, headless primitives                                                  | `packages/react`                                        |
| Full demo (Express, TanStack Table, Recharts)                                         | `examples/demo`                                         |
| README quick start as an app                                                          | `examples/quickstart`                                   |
| Eval set and CLI                                                                      | `evals/` (`pnpm eval`)                                  |
| Guides and generated API reference                                                    | `docs/` (`pnpm docs:api`)                               |
| Tarballs for trying it elsewhere                                                      | `pnpm pack:local`                                       |
| Catalog, `t.query`, data blocks, aggregator                                           | `packages/core` (`catalog.ts`, `query.ts`, `blocks.ts`) |
| `patina scan` / `check` / `init-action`                                               | `packages/cli`                                          |
| GitHub Action (committed bundle)                                                      | `packages/action`                                       |

---

## 15. Proposed: data-bound views from the app's existing API

> Status: **signed off and implemented**. It differs from the draft in these ways:
>
> - **Three blocks, not four.** `PatinaTable` covers the "rows" shape, so `List` was dropped.
> - **`requires` uses `ctx.permissions`.** It is checked against `permissions` on the handler's
>   context.
> - **The GitHub Action was added (§15.8).** It uses a static parser for `catalog.ts`.
> - **User guides:** `docs/guides/data-views.md` and `docs/guides/github-action.md`.

### Goal

Today users can only rearrange, hide and configure what the host already renders. This
extension lets them **compose new views of data the app already exposes**. For example:

- _"add a chart of revenue by vet"_
- _"add the owner's phone number as a column"_
- _"show a card with this week's no-shows"_

These views must look like the rest of the app, and the following rules still hold:

- **No business logic and no code is generated at runtime.** A new view is still a
  declarative patch: _which_ data source, _which_ fields, _which_ built-in block and _which_
  of a fixed set of display aggregations. It is validated like every other patch.
- **Data comes only from the host's existing read endpoints**, called from the browser with
  the user's own session, exactly as the app already does. Patina adds no endpoints and no
  queries, so it cannot widen what a user can see. If the API returns a 403 or omits a
  field, the view shows nothing for it.

### Overview

```
 dev time (CLI, output reviewed and committed)        runtime (unchanged safety model)
 ─────────────────────────────────────────────        ────────────────────────────────
 patina scan ──▶ patina/catalog.ts                     model ─▶ insert { block, source, fields, … }
   heuristics:     data sources: GET endpoints,                │  validated against catalog + manifest
   OpenAPI,        params, fields + types + labels             ▼
   Prisma, zod,  ─▶ patina/blocks.tsx                    <Surface> renders the host-styled block,
   TS types,        DataTable / Chart / StatCard /         which fetches through the host's
   routes,          List built from the app's own          fetchSource(source, params)
   Tailwind/CSS     components and tokens
   vars, UI lib   (optional --ai: Claude drafts both from the scan summary)
```

### 15.1 The data catalog

The catalog lists the read-only data sources Patina may offer. `patina scan` drafts it, and a
developer reviews and commits it. It is the allowlist: anything not in it doesn't exist as
far as the model is concerned.

```ts
// patina/catalog.ts (generated by `patina scan`, then edited by hand)
import { defineCatalog, f } from "@patina-ui/core";

export const catalog = defineCatalog({
  appointments: {
    label: "Appointments",
    description: "One row per appointment.",
    endpoint: { path: "/api/data/appointments", method: "GET" }, // GET only
    params: {
      // bound to page filters
      range: { from: "filters.dateRange" },
      status: { from: "filters.status" },
    },
    fields: {
      date: f.date({ label: "Date" }),
      patient: f.string({ label: "Patient" }),
      species: f.enum(["Dog", "Cat", "Rabbit"], { label: "Species" }),
      vet: f.string({ label: "Vet" }),
      status: f.enum(["scheduled", "completed", "cancelled", "noShow"], { label: "Status" }),
      revenue: f.currency("EUR", { label: "Revenue", requires: "finance.read" }),
      ownerPhone: f.string({ label: "Owner phone", sensitive: true }), // never offered to the model
    },
    rowKey: "id",
  },
});
```

- **Field types:** `string`, `number`, `currency`, `date`, `enum`, `bool`. These drive
  formatting and which aggregations are allowed (you can sum `currency`, but not `string`).
- **`requires`** connects a field to the existing `restrict(ctx)`: the field is removed from
  the catalog for users who lack that permission. This is the same mechanism as for columns
  today.
- **`sensitive: true`** fields are never offered to the model, and can only appear where the
  host's own base spec already renders them.

### 15.2 Blocks: generic, host-styled renderers

A small fixed set of **blocks** renders catalog data:

| Block       | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| `DataTable` | selected fields as columns                                       |
| `Chart`     | line or bar: one aggregation grouped by a field or a date bucket |
| `StatCard`  | one aggregation                                                  |
| `List`      | a compact list of rows                                           |

The blocks are ordinary components in the host repo. `patina scan` generates them into
`patina/blocks.tsx` from the app's own design system (§15.4), so they look native. Each block
is registered in the manifest like any other component. Its props are typed by a new DSL type
that depends on the catalog:

```ts
t.query(catalog, { blocks: ["Chart"], aggregations: ["count", "sum", "avg"] });
// value: { source: "appointments", groupBy: "vet", metric: { op: "sum", field: "revenue" } }
```

Validation checks that the source exists and the user may see it, that the fields belong to
that source and aren't restricted or sensitive, and that the aggregation suits the field type.

**Aggregation is display-only and runs in the browser** over rows the endpoint already
returned: `count`, `sum`, `avg`, `min` and `max`, grouped by a field or a day/week/month
bucket, with sort and limit. That's computation over visible data, not business logic. A
documented limit follows from this: it only covers the rows the endpoint returns, so it is
wrong for paginated endpoints unless the catalog marks the source `complete: true` or
declares a page-size param.

### 15.3 Patches: insert with configuration

`insert` currently creates a node from a fixed preset. It gains optional **`props`**,
validated against the inserted component's manifest types (§3), so a block can be configured
when it's added:

```json
{
  "op": "insert",
  "node": "page",
  "prop": "main",
  "preset": "block.chart",
  "key": "u_7f3a",
  "to": { "after": "revenue-chart" },
  "props": {
    "kind": "bar",
    "query": {
      "source": "appointments",
      "groupBy": "vet",
      "metric": { "op": "sum", "field": "revenue" }
    }
  }
}
```

Existing tables can also offer catalog fields as new columns.
`t.collection({ keysFrom: { catalog, source: "appointments" } })` makes every non-sensitive,
permitted field of the source a possible column (hidden by default). _"Add the species
column"_ then becomes a plain `set … hidden: false`.

Everything else stays the same: the model's output schema is compiled from the restricted
catalog and manifest, insert keys are generated by the server, there's one repair round-trip,
and previews and the change list come from `describe()`.

### 15.4 `patina scan`: what it detects

`npx patina scan` is fast, deterministic and offline. It finishes in seconds on a typical
repo, because it reads known files instead of parsing everything.

| Looks for                                                                         | Gets                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `openapi.{json,yaml}`, `swagger.*`                                                | GET endpoints, query params, response schemas (best source)                     |
| `schema.prisma`, Drizzle schemas                                                  | models, field types, enums                                                      |
| zod schemas, exported TS types next to API code                                   | response shapes                                                                 |
| Express, Hono and Next.js route files (`app.get(...)`, `route.ts` with `GET`)     | read endpoints and paths                                                        |
| `tailwind.config.*`, CSS custom properties (`--color-*`, `--radius`), theme files | design tokens                                                                   |
| `package.json`                                                                    | UI library (shadcn/ui, MUI, Chakra, Mantine, Ant), chart library, table library |
| `components/ui/*`, `src/components/**`                                            | existing `Button`, `Card`, `Table`, `Input` to reuse in blocks                  |

The scan writes three files, all meant to be reviewed:

- **`patina/scan.json`**: the raw findings.
- **`patina/catalog.ts`**: a draft. Endpoints it found but couldn't type become `TODO`s.
- **`patina/blocks.tsx`**: block components built from the detected UI kit, with templates
  for shadcn/Tailwind, MUI, Chakra and plain CSS. They import the app's own `Card` and
  `Table` when found, and fall back to tokens when not.

**`--ai` (optional)** sends Claude the _scan summary_ plus a handful of representative files:

- the detected `Card` and `Table`;
- one existing page that uses them;
- the type files for the endpoints.

Claude then fills in labels and descriptions, resolves `TODO` field types, and adapts
`blocks.tsx` to the app's conventions. Claude never receives secrets or `.env` files, or
anything that matches the ignore list. The output is still a file diff for the developer to
review. Nothing is applied at runtime.

### 15.5 Safety deltas

| Risk                                                    | Mitigation                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Showing data the user can't otherwise see               | Data is fetched only through the host's existing endpoints, with the user's own session. The API stays the authority           |
| The model inventing endpoints or URLs                   | Sources are catalog IDs that map to host-declared GET paths. The model never sees or emits a URL                               |
| Leaking sensitive fields to the model or into new views | `sensitive` fields are excluded from the schema, the prompt and `keysFrom`. `requires` ties into `restrict`                    |
| Writes through the API                                  | The catalog accepts only `GET`. Blocks have no actions                                                                         |
| Expensive or abusive queries                            | No new queries. Endpoints are called with the same params the page already uses, with a per-surface limit on concurrent blocks |
| Repo contents sent to an LLM by `--ai`                  | Opt-in, summary plus a small set of named files, ignore list for secrets, and the developer reviews the output                 |

### 15.6 Open questions

| #   | Question                                                                                                                                                       | Recommendation                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Who fetches data: Patina's blocks via a host `fetchSource(source, params)` passed to `<PatinaProvider>`, or the host's own data layer (React Query and so on)? | **`fetchSource`**, defaulting to `fetch(endpoint)` with cookies. Hosts with React Query pass a function that uses it, so caching and auth stay theirs |
| B   | Aggregate in the browser vs require the host to expose aggregate endpoints                                                                                     | **Browser**, with `complete: true` required on a source before aggregation is offered. It's honest and adds nothing to the host's API                 |
| C   | Catalog in code (`catalog.ts`) vs JSON                                                                                                                         | **Code**: type-checked, and can import the host's types                                                                                               |
| D   | First scan targets                                                                                                                                             | **OpenAPI, Prisma, zod, Express/Next routes, and Tailwind/shadcn first.** MUI and Chakra templates next                                               |
| E   | Should `--ai` be part of `scan` or a separate `patina enrich` step?                                                                                            | **Separate** (`patina scan --ai` is shorthand for both), so the deterministic part stays free and reproducible                                        |
| F   | New package or part of server?                                                                                                                                 | **A new `@patina-ui/cli`** package (bin `patina`), plus `defineCatalog`, `f.*`, `t.query` and the client-side aggregator in `core`                    |

### 15.7 Build order (done)

1. **Core:** `defineCatalog`, `f.*`, `t.query`, `keysFrom`, and `insert` with `props`. Then
   validation, schema compilation and the aggregator, with property tests for the aggregator.
2. **React:** `fetchSource` on the provider, and the block contract (each block receives
   `{ rows, status, query }`).
3. **CLI:** `patina scan` heuristics with fixtures for each detector, writing
   `catalog.ts` and `blocks.tsx` templates.
4. **Demo:** a catalog for the appointments endpoint, generated blocks, prompts like _"add a
   bar chart of revenue by vet"_, and the extra cases in the eval set.
5. **`--ai` enrichment.**
6. **Docs:** a "Data views" guide and an update to "Trying Patina in your app" with
   `npx patina scan`.

### 15.8 Keeping the catalog in sync: `patina check` and the GitHub Action

A catalog is only useful while it matches the code. `patina check` re-runs the scan and
compares it with two things:

1. **The committed `patina/scan.json`**, the snapshot from the last `patina scan`. This
   catches new or removed endpoints, new fields, UI kit and component moves, token changes,
   and a stale snapshot.
2. **`patina/catalog.ts`**, read with a small static parser rather than executed, so CI needs
   no `npm install`. This catches catalog fields that are no longer returned, type changes,
   lost enum values, and endpoints that disappeared.

Findings are graded on three levels:

- **breaking:** saved views that use this stop showing data.
- **changed:** worth reviewing.
- **info:** a note only.

To keep reports quiet, fields left out of the catalog on purpose are only reported when they
are _new_ since the last snapshot.

`packages/action` is a Node action whose bundle is committed to `dist/`. Teams register it
with `npx patina init-action`, or add `uses: paulocerez/patina/packages/action@v0` by hand.
The Action:

- runs the check;
- writes the job summary;
- keeps one PR comment up to date (identified by a hidden marker);
- fails per `fail-on`.

Fork PRs, which get read-only tokens, skip the comment with a warning. This repo dogfoods it on
`examples/demo` (`.github/workflows/patina-demo.yml`), and CI fails if the bundle is stale.

---

## 16. Availability: feature flags, plans and quotas

Hosts decide per request who may customize, through a server hook. Feature flags (any
provider), plans, roles and trials all go through it:

```ts
availability?(ctx, surfaceId): { customize?, dataViews?, whenOff?: "keep" | "base", message? } | Promise<…>
limits.monthlyProposals?(ctx): { user?: number; tenant?: number } | undefined
```

**Decisions:**

- **The view always renders.** Availability gates changes, never reads. Turning Patina off for
  a customer must not break their page.
- **`whenOff: "keep"` is the default** (signed off). Users who lose access keep their saved
  customizations visible but frozen. `"base"` shows the default view without deleting
  history, so access coming back restores it. Both apply to `customize` and to `dataViews`.
- **The server enforces it, not the UI.** POST routes return 403 with the host's message. When
  `dataViews` is off, edits are checked against a manifest without data-block presets and
  with an empty catalog for queries (`withoutDataViews`). The model isn't told about data
  sources, and requests for data views are refused with the host's message. Existing blocks
  keep rendering ("keep"), because the render manifest still has the catalog.
- **The UI follows the state.** `SurfaceState.availability` drives the React primitives, which
  hide themselves, and `AvailabilityNotice`.
- **Quotas count model calls** per user and/or tenant per calendar month, through the optional
  `StorageAdapter.incrementUsage` (Postgres table `patina_usage`). They are checked before
  the model is called.

`restrict(ctx)` (§3) still handles _what_ may be customized. `availability` handles _whether_
anything may be.

---

## 17. Request log and insights

Unbuildable requests are product signal. Every customization request produces one
`RequestEvent`:

- **What happened** (`outcome`): proposed, applied, refused, clarified, answered, unavailable,
  over_quota or error.
- **Who decided** (`source`): the model, the validator, or the host's rules.
- **Why** (`reason`): a code.
- **What the user saw** (`message`).
- **The full prompt.** This was signed off; it is cleared by `redactPrompts` with the rest.

**Decisions:**

- **The model tags its own refusals.** The output schema gains a nullable `category`
  (missing_field, missing_setting, missing_value, data_access, action, new_component, styling,
  not_on_page, unclear, safety or other) and `detail: { node, wanted }`, which the server checks
  against the manifest and stores, so "summary column on recentCalls × 2" groups by itself. Validator and
  host refusals use their own codes, so every refusal is grouped without parsing text.
- **Storage is optional and append-only.** `logRequest` and `listRequests` are optional
  adapter methods (Postgres `patina_requests`), and logging can't affect the user. `onEvent`
  receives the same events for analytics, and its errors go to `onError`.
- **The report is computed, not generated.** `summarizeRequests` groups refused or unavailable
  requests by normalized wording (case, punctuation, polite filler), ranks them by distinct
  organizations and then count, and breaks down reasons. It needs no model calls, so it is
  cheap and reproducible.
- **Three ways to read it:**
  - `patina insights --database-url` for developers;
  - `GET {basePath}/insights`, gated by `insights.allow(ctx)`, for staff tools;
  - `getInsights` / `summarizeRequests` in code.

**Possible follow-up:** model-assisted clustering of differently worded requests into themes
("export", "bulk actions"), as an opt-in `--ai` flag on `patina insights`.

---

## 18. Reliability on real prompts (0.7)

The first real host (German, one user, two sessions) showed what goes wrong with real prompts:
a false refusal of an allowed enum value, a capability question refused as `new_component`,
clarifications offering impossible options and losing their thread, `other` refusals nobody
could act on, and four undos in two seconds.

**Decisions:**

- **One retry for refusals, by the backup model, with the relevant manifest excerpt.** Any
  refusal but `safety` gets the second call the repair round-trip already had. Calls stay ≤ 2.
- **A deterministic guard before any refusal.** If the prompt names an allowed value of a
  setting the refusal is about, or a hidden column of a table it names, Patina proposes it (or
  asks which). It never overrides `safety`, `data_access` or `action`. Matching is
  case/umlaut-folded with a light de/en stem, no model and no dictionary. Rescues are logged as
  source `guard` so the model's mistakes become eval cases.
- **Questions are answered from the manifest.** A regex detector catches "what can I …?" before
  any model call; the model's `answer` kind covers the rest. The text always comes from
  `capabilities()`, never from the model, so an answer can't list something that doesn't exist.
  The response carries `question` too, so 0.6 clients (which show `question` for unknown kinds)
  show it.
- **Clarify options carry op indices** into the answer's `ops` (keeps the precise schema small)
  and are validated one by one. The thread is stateless (`thread: { prompt, question }` in the
  request): spoofing it only changes the user's own words, and a reply's schema has no
  `clarify` kind, which caps clarifications at one without server state.
- **Redo is a revert of a revert.** `revertedIds` ignores reverts that were themselves reverted,
  which leaves every existing history unchanged. `expectedSeq` on undo/redo/reset turns a
  double click into a 409 instead of a second undo.
- **`privacy: "display"`** sits between full use and `sensitive`: shown as a column and in
  capabilities, never filtered/grouped/sorted/aggregated, values never sent to the model.

## 19. Localization

Patina's user-facing texts come from one catalog (`core/src/i18n.ts`) in English and German.
German uses the formal "Sie", as in vetpal and most German business software.

**How the locale flows:**

- Every request has a locale: the host's `locale` hook, else the `locale` query parameter (sent by
  `<PatinaProvider locale>`), else `Accept-Language`, else English.
- The handler localizes the manifest (`localizeManifest`), so validation messages, previews,
  value names and data-view titles come out in that language.
- The model is told the reply language in the user turn. The system prompt stays English and
  identical for every user, so prompt caching keeps working.
- The browser's catalog gets resolved labels.

**Host labels and descriptions:** host labels are `Text` (a string, or one string per
language), resolved exact → base language → English → any. Descriptions are model-only and
read in English.

**Grammar:**

- Templates are whole sentences per language (German puts verbs last).
- English lowercases names mid-sentence; German keeps noun capitals.
- Quotes are “…” in English and „…“ in German.

**Not translated:** developer-facing output (the CLI, insights, the GitHub Action, developer
errors).
