# @patina-ui/server

The server half of [Patina UI](https://github.com/paulocerez/patina): one fetch-style request handler `(Request) => Promise<Response>` that turns a user's prompt into a validated patch, previews it, and stores it per user.

```sh
npm i @patina-ui/server @patina-ui/core @anthropic-ai/sdk
```

```ts
import { createPatinaHandler, postgresStorage } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";
import { toExpress } from "@patina-ui/server/express";

const patina = createPatinaHandler({
  surfaces: [orders],
  storage: postgresStorage({ query: (sql, params) => pool.query(sql, params) }),
  model: anthropicModel(), // reads ANTHROPIC_API_KEY, server-side only
  basePath: "/api/patina",
  getContext: async (req) => {
    const u = await yourAuth(req);
    return u ? { userId: u.id } : null;
  },
});
app.use("/api/patina", toExpress(patina)); // or export it as GET/POST in Next.js, Hono, …
```

Entry points: `@patina-ui/server` (handler, storage), `/anthropic` (model adapter), `/express`, `/testing` (`scriptedModel`), `/eval` (`runEval`). Docs: [server setup](https://github.com/paulocerez/patina/blob/main/docs/guides/server-setup.md).
