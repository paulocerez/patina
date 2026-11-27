# Evolving base views

Users' customizations are stored as patches against your base view. When you ship a new
base view, Patina replays their patches on the new one. It migrates what it can, skips what
no longer fits, and tells the user.

## The rules

1. Bump `version` in `defineSurface` and `baseVersion` in the base spec together.
2. Add migrations for anything you **renamed**. You don't need migrations for things you
   **added**: new columns and sections simply appear for everyone. Removals need none
   either: ops that target removed things are skipped.
3. Never reuse a key for something different. Patches address nodes and items by key.

## Migrations

```ts
import { migrations as m } from "@patina/core";

defineSurface({
  version: 3,
  migrations: {
    2: [m.renameKey("appointments", "columns", "vet", "doctor")], // v1 → v2
    3: [
      m.renameProp("DataTable", "pageSize", "rowsPerPage"), // v2 → v3
      m.renameNode("revenue-chart", "revenue-trend"),
      m.dropNode("legacy-banner"),
    ],
  },
});
```

A patch saved at version 1 passes through the steps for 2 and then 3. Each step is a list of
functions `(op, spec) => Op | null`. Write your own for anything else, and return `null` to
drop an op on purpose.

| Helper                            | Use when                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `renameKey(node, prop, from, to)` | a column or slot item key changed                                              |
| `renameProp(component, from, to)` | a prop of a component was renamed                                              |
| `renameNode(from, to)`            | a node ID changed. References to it in slots and anchors are updated too       |
| `dropNode(id)`                    | a node is gone, and ops on it should vanish silently instead of being reported |

Migrations run **on read**. Stored patches are never rewritten, so fixing a buggy migration
fixes every user at once.

## What users see

Ops that still don't apply after migration (an anchor that no longer exists, a value now out
of range, a removed column) are skipped. `GET /surfaces/:id` returns them in `skipped` with
readable reasons, and `<SkippedNotice>` shows _"1 of your earlier changes no longer
applies"_ with the details. The rest of their customization still applies.

## Testing an upgrade

Write a test that resolves an old patch against the new manifest:

```ts
import { resolve } from "@patina/core";

const r = resolve(dashboardV2, [
  { name: "user", entries: [{ kind: "patch", id: "p", seq: 1, patch: oldPatch }] },
]);
expect(r.skipped).toEqual([]); // or the skips you expect
```

`packages/core/test/history.test.ts` has a full example.
