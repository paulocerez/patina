# @patina-ui/core

The framework-free heart of [Patina UI](https://github.com/paulocerez/patina): let users customize your app's views in plain language, while the model only ever returns declarative, validated patches.

- `defineSurface`, `t.*`: declare a customizable view and exactly what may change
- `apply` / `validate` / `invert` / `compose` / `describe`: the patch engine (pure, deterministic, property-tested)
- `resolve`, `migrations`: layered resolution and safe replay when your base view evolves
- `defineCatalog`, `f.*`, `t.query`, `dataBlocks`, `runQuery`: data views over endpoints your app already exposes

```sh
npm i @patina-ui/core
```

```ts
import { defineSurface, t } from "@patina-ui/core";

export const orders = defineSurface({
  id: "orders",
  version: 1,
  base: {
    schemaVersion: 1,
    surfaceId: "orders",
    baseVersion: 1,
    root: "table",
    nodes: {
      table: { component: "OrdersTable", props: { columns: [{ key: "date" }, { key: "total" }] } },
    },
  },
  components: {
    OrdersTable: {
      props: { columns: t.collection({ keys: ["date", "total"], reorder: true, hide: true }) },
    },
  },
});
```

No dependencies. Use it with [`@patina-ui/server`](https://www.npmjs.com/package/@patina-ui/server) and [`@patina-ui/react`](https://www.npmjs.com/package/@patina-ui/react). Docs: [github.com/paulocerez/patina](https://github.com/paulocerez/patina#readme).
