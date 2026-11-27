# Permissions and safety

Patina changes **how** things are presented, never **what** a user may see or do. This page
covers what Patina enforces and what remains your job.

## What Patina enforces

1. **Closed set of changes.** Only the props your manifest lists can change, and only to
   values their types allow. The type system has no URL, HTML, CSS, script or open-object
   type.
2. **Validation everywhere.** Patches are validated when proposed, again when committed,
   and every stored patch is re-checked whenever the view is resolved. Invalid stored ops
   are skipped, not trusted.
3. **No code, no markup.** The model returns data, never code. The renderer passes values
   as props, and `t.label` text is length-limited, stripped of control characters and
   rendered as text.
4. **Per-request restriction.** `restrict(ctx)` removes columns, nodes and presets for this
   user. The restricted manifest drives the model's output schema, validation and rendering,
   so the model never learns that restricted things exist.
5. **Server-side model calls.** API keys stay on your server. The client commits a proposal
   by **ID**, so it can't swap in a different patch.
6. **Identity from your session only.** `getContext(request)` decides who the user is.
   Identity is never read from the request body.
7. **Prompt-injection containment.** The model sees the _structure_ of the view (IDs,
   labels, settings), never data rows. That structure sits in a block marked as data, not
   instructions. Even a successful injection can only produce a patch the user could have
   asked for, which they still preview before applying.
8. **Readable refusals.** Requests outside the manifest are refused by the model or
   rejected by the validator, with a message written for the user.

## Data views

[Data views](data-views.md) add a few rules:

- **The catalog is an allowlist** of GET endpoints on your own origin. The model refers to
  sources by ID and never sees or produces a URL.
- **Your API serves the data**, called from the browser with the user's session. If it
  answers 403 or leaves a field out, the block shows nothing for it.
- **`sensitive: true` fields** are never offered to the model, never usable in new views, and
  never sent to the browser's catalog.
- **`requires: "permission"`** removes a field or source for users without it (checked
  against `ctx.permissions`), including views they saved before losing access.
- **Aggregation is display-only arithmetic** over rows already returned, and only on
  `complete` sources.

## What stays your job

- **Enforce permissions in your data layer.** A spec that says "show the revenue column"
  grants no data. Your API must still filter what each user can fetch. In the demo,
  `/api/data/appointments` drops `revenue` for users without `finance.read`, whatever the
  spec says. Use `restrict` so restricted things aren't _offered_, and your API so they
  aren't _served_.
- **Treat props as untrusted input** to your components. They can only hold values your
  manifest allows, but your components are the last line of defence. For example, map a
  `metric` enum to known queries, never interpolate it into SQL.
- **Authenticate `/api/patina`** like the rest of your API, and rate-limit across
  instances. The built-in limit is per process.
- **Decide on prompt retention** (`redactPrompts`, see [Storage](storage.md)).

## Testing refusals

`scriptedModel` makes refusal paths deterministic in your tests:

```ts
const model = scriptedModel(() => ({
  kind: "patch",
  message: "",
  ops: [
    {
      op: "insert",
      node: "kpis",
      prop: "cards",
      preset: "deleteButton",
      position: "end",
      anchor: "",
    },
  ],
}));
// → { kind: "refusal", message: "“Delete button” isn't something you can add here. You can add: No-shows card." }
```

Add the real-model versions to your eval set ([Model and evals](model-and-evals.md)).
