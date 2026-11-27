# Defining a surface

A **surface** is one customizable view. You define it once on the server with
`defineSurface` from `@patina-ui/core`:

```ts
defineSurface<Ctx>({
  id,
  version,
  base, // identity and the default view
  description,
  labels, // words for the model and for previews
  components, // what may change, per component
  presets, // what users may add
  restrict, // per-request narrowing (permissions)
  migrations, // keeping old customizations working
});
```

`defineSurface` checks the base spec against the manifest and throws a readable error at
startup if they disagree. For example, it catches a slot that references a missing node, a
base value out of range, or a component that isn't registered.

## The base spec

```ts
{
  schemaVersion: 1,            // Patina's format version
  surfaceId: "orders",         // must equal `id`
  baseVersion: 1,              // must equal `version`
  root: "page",
  nodes: {
    page:  { component: "Page", props: { main: [{ key: "table" }] } },
    table: { component: "OrdersTable", props: { columns: [{ key: "date" }, { key: "total" }], pageSize: 25 } },
  },
}
```

- **Node IDs are stable keys.** Patches refer to them, so don't rename them casually (see
  [Changing the base view](#changing-the-base-view)). The `u_` prefix is reserved for things
  users add.
- **Ordered things are keyed lists** (`[{ key }]`). Patches address items by key, never by
  position, so adding a column later doesn't break anyone's saved order.
- **No data, no copy.** Rows and numbers come from your own data layer at render time.

## Declaring what may change

Each component lists the props users may change and their types. Props not listed keep their
base values and can't be targeted.

```ts
components: {
  OrdersTable: {
    label: "Table",                       // used in previews when a node has no label
    description: "One row per order.",    // for the model
    props: {
      columns: t.collection({ keys: [...], labels: {...}, reorder: true, hide: true }),
      pageSize: t.int({ min: 10, max: 100 }, { label: "Rows per page" }),
    },
  },
}
```

### Types

The type set is closed on purpose. There is no URL, HTML, CSS, script or free-form object type,
so a manifest can't open those doors by accident.

| Type                                                  | Value                                              | Notes                                                                          |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `t.enum(values, { labels })`                          | `"compact"`                                        | `labels` gives each value a human name for previews                            |
| `t.int({ min, max })`                                 | `25`                                               |                                                                                |
| `t.bool()`                                            | `true`                                             |                                                                                |
| `t.label({ maxLen })`                                 | `"Order total"`                                    | Plain text. Control characters are rejected, and it is always rendered as text |
| `t.relativeDateRange(allowed)`                        | `{ relative: "thisWeek" }`                         | Always relative, so "this week" stays correct next week                        |
| `t.sort(keys)`                                        | `{ key: "date", dir: "desc" }`                     |                                                                                |
| `t.object({ … })`                                     | fixed shape of the scalar types above              |                                                                                |
| `t.collection({ keys, labels, reorder, hide, item })` | `[{ key: "date", hidden?: true, label?: "When" }]` | Keys are fixed by you. `item` declares extra per-item fields                   |
| `t.slot({ accepts, reorder, hide, insert })`          | `[{ key: "table" }]`                               | Child nodes. `accepts` lists component names, and `insert` lists preset IDs    |

Every type takes an optional `{ label, description }` as its last argument. `label` appears in
previews and error messages ("Rows per page must be a whole number from 10 to 100.").
`description` is shown to the model.

A `null` value always means "back to the default", so undo can restore props that were
originally unset.

### Labels

`labels` names nodes for humans and for the model:

```ts
labels: { appointments: "Appointments table", "revenue-chart": "Revenue chart" }
```

These names appear in previews ("Move Appointments table before Revenue chart") and help the
model map "the chart" to `revenue-chart`. Collection items take their names from the
collection's own `labels`.

## Presets: what users may add

Users can't create arbitrary components. They can only insert **presets** you define, into
slots that list them in `insert`:

```ts
presets: {
  "stat.noShows": {
    label: "No-shows card",
    description: "KPI card: number of no-show appointments.",
    node: { component: "StatCard", props: { metric: "noShows" } },
  },
},
components: {
  StatRow: { props: { cards: t.slot({ accepts: ["StatCard"], reorder: true, hide: true, insert: ["stat.noShows"] }) } },
}
```

Presets must be leaf components (no slots). Users can remove what they added, but they can only
**hide** base items, never remove them.

## Permissions: `restrict`

`restrict(ctx)` runs on every request with your context from `getContext`, and returns what to
take away for this user:

```ts
restrict: (ctx) =>
  ctx.permissions.includes("finance.read")
    ? {}
    : { keys: ["revenue"], nodes: ["stat-revenue", "revenue-chart"], presets: ["stat.avgRevenue"] },
```

| Field     | Effect                                                                  |
| --------- | ----------------------------------------------------------------------- |
| `keys`    | Removed from every collection and sort type, and from the resolved spec |
| `nodes`   | Removed from the resolved spec and from every slot                      |
| `presets` | Can't be inserted                                                       |

Restricted things are not rendered, not shown to the model and can't be targeted by a patch.
This is only part of the protection: **your data layer must still enforce permissions**. A spec
only decides how things are presented. The props your components receive never grant data.
In the demo, the data API strips `revenue` for users without `finance.read`, whatever the
spec says.

## Changing the base view

When you ship a new base view, bump both `version` and `base.baseVersion`. Users' stored
patches are **replayed on read**:

1. Each stored patch passes through every migration between its `baseVersion` and the
   current version.
2. The migrated ops apply one by one. Any op that no longer fits (a removed column, an anchor
   that's gone, a value now out of range) is **skipped and reported** rather than crashing the
   view.

```ts
import { migrations as m } from "@patina-ui/core";

defineSurface({
  version: 2,
  migrations: {
    2: [
      m.renameKey("appointments", "columns", "vet", "doctor"),
      m.renameProp("DataTable", "pageSize", "rowsPerPage"),
      m.renameNode("revenue-chart", "revenue-trend"),
    ],
  },
  // …
});
```

A migration can also be any function `(op, spec) => Op | null`. Return `null` to drop an op on
purpose. Stored patches are never rewritten, so fixing a buggy migration fixes everyone.

`<SkippedNotice>` shows users which of their earlier changes no longer apply. More in
[Evolving base views](evolving-base-views.md). Every type is listed in the
[type reference](types.md).
