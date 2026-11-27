# Type reference

Every customizable prop is declared with one of these types from `t` in `@patina-ui/core`. The
last argument is always optional metadata: `{ label?, description? }`.

- **`label`** is used in previews and messages ("Rows per page must be a whole number from 10
  to 100.").
- **`description`** is shown to the model.

`null` is accepted for every scalar type and means "back to the default". Undo relies on it.

## Scalars

### `t.enum(values, { labels? })`

```ts
density: t.enum(["compact", "comfortable"], { label: "Row density" });
status: t.enum(["all", "noShow"], { labels: { noShow: "No-show" } }); // names for previews
```

### `t.int({ min, max })`

```ts
pageSize: t.int({ min: 10, max: 100 }, { label: "Rows per page" });
```

The bounds are enforced by the validator. They are also stated to the model, because
structured outputs can't express numeric bounds.

### `t.bool()`

### `t.label({ maxLen })`

Short, user-chosen text, such as a custom column heading. It is rejected if longer than
`maxLen` or if it contains control or bidi-override characters. It is always rendered as
text.

### `t.relativeDateRange(allowed)`

```ts
dateRange: t.relativeDateRange(["today", "thisWeek", "thisMonth", "last30Days"]);
// value: { relative: "thisWeek" }
```

Allowed values: `today`, `yesterday`, `thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`,
`last7Days`, `last30Days`, `last90Days`, `thisYear`. Dates are never absolute, so "this week"
means this week whenever the page is opened.

### `t.sort(keys)`

```ts
sort: t.sort(["date", "patient"]); // value: { key: "date", dir: "desc" }
```

### `t.object(fields)`

A fixed shape built from the scalar types above. Every field is required, and unknown fields
are rejected.

### `t.query(catalog, { shape, aggregations? })`

A view over a [catalog](data-views.md) source, used by the data blocks.

```ts
query: t.query(catalog, { shape: "series" }); // "rows" | "series" | "single"
// value: { source: "appointments", groupBy: { field: "vet" }, metric: { op: "sum", field: "revenue" } }
```

It's validated against the user's restricted catalog. Only the source's fields are allowed,
never sensitive ones, and aggregations need a `complete` source and a number field. You
rarely write this yourself: `dataBlocks(catalog)` declares it for you.

## Lists

Lists are ordered and keyed. Patches address items by key, never by index.

### `t.collection({ keys, labels?, reorder?, hide?, item? })`

Items of a component, such as table columns.

```ts
columns: t.collection({
  keys: ["date", "customer", "total"], // every key that may exist
  labels: { date: "Date", customer: "Customer" }, // names for previews and the model
  reorder: true,
  hide: true,
  item: { label: t.label({ maxLen: 30 }, { label: "Heading" }) }, // extra per-item fields
});
// value: [{ key: "date" }, { key: "total", hidden: true }, { key: "customer", label: "Client" }]
```

A collection can't be replaced as a whole, which would let a patch invent items. Its items can
be moved, hidden and have their `item` fields set.

Pass `keysFrom: { catalog, source }` (instead of, or alongside, `keys`) to offer every
non-sensitive field of a catalog source. Fields the base spec doesn't list are added as
hidden items, so _"show the owner column"_ just works. Fields the user lacks permission for
are removed.

### `t.slot({ accepts, reorder?, hide?, insert? })`

Child nodes, i.e. layout.

```ts
main: t.slot({ accepts: ["FilterBar", "Chart", "DataTable"], reorder: true, hide: true });
cards: t.slot({ accepts: ["StatCard"], reorder: true, hide: true, insert: ["stat.noShows"] });
```

`insert` lists the **presets** users may add here (see
[Defining a surface](define-a-surface.md#presets-what-users-may-add)). Users can remove what
they inserted, but can only hide base items.

## Ops (for reference)

Patches are lists of these. You only write them yourself in tests, eval cases and history
seeds.

```ts
{ op: "set",    node, path: [prop], value }                      // a whole scalar prop
{ op: "set",    node, path: [prop, itemKey, field], value }      // a list item field, e.g. "hidden"
{ op: "move",   node, prop, key, to: { before } | { after } | "start" | "end" }
{ op: "insert", node, prop, preset, key: "u_…", to, props? }   // props: settings for the new node
{ op: "remove", node, prop, key: "u_…" }
```
