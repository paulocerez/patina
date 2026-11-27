# Server setup

`@patina-ui/server` provides one request handler, a model adapter and storage adapters.

```ts
import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";

export const patina = createPatinaHandler({
  surfaces: [dashboard, orders],
  storage: memoryStorage(),
  model: anthropicModel(),
  basePath: "/api/patina",
  getContext: async (req) => {
    const s = await getSession(req);
    return s ? { userId: s.userId, tenantId: s.orgId, permissions: s.permissions } : null;
  },
  limits: { promptMaxChars: 500, proposalsPerMinute: 10, proposalTtlSeconds: 900 },
  onError: (e) => logger.error(e),
});
```

## Who gets it

`availability(ctx, surfaceId)` turns customizing and data views on or off per user, from
feature flags, plans or anything else. `limits.monthlyProposals(ctx)` sets monthly quotas.
The view always renders, and users who lose access keep their saved changes by default. See
[Availability](availability.md).

## Mounting

The handler is `(request: Request) => Promise<Response>`, so it works anywhere the Fetch API
does. Set `basePath` to wherever you mount it.

**Express**

```ts
import { toExpress } from "@patina-ui/server/express";
app.use("/api/patina", toExpress(patina));
```

`toExpress` works with or without `express.json()` in front of it.

**Next.js (App Router)**: `app/api/patina/[...path]/route.ts`

```ts
export const GET = patina;
export const POST = patina;
```

**Hono / Bun / Deno**

```ts
app.all("/api/patina/*", (c) => patina(c.req.raw));
```

## Routes

| Route                                      | Body         | Returns                                                                                                                        |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /surfaces/:id`                        |              | `SurfaceState`: resolved spec, skip report, `canUndo`, `isCustomized`                                                          |
| `POST /surfaces/:id/proposals`             | `{ prompt }` | `{ kind: "proposal", proposalId, changes, previewSpec, … }`, `{ kind: "refusal", message }` or `{ kind: "clarify", question }` |
| `POST /surfaces/:id/proposals/:pid/commit` |              | `SurfaceState` (409 if the proposal expired or no longer applies)                                                              |
| `POST /surfaces/:id/undo`                  |              | `SurfaceState`                                                                                                                 |
| `POST /surfaces/:id/reset`                 |              | `SurfaceState`                                                                                                                 |

Errors are `{ error: { message } }`, with messages written for end users.

## Identity: `getContext`

`getContext(request)` must derive the user from **your** session (cookie, bearer token and
so on). Patina never reads identity from the request body. Return `null` for unauthenticated
requests, which get a 401.

The context object is passed to each surface's `restrict(ctx)`, so put whatever your
permission checks need on it. `userId` is required. Set `tenantId` to scope histories per
organization, which also enables the tenant layer (see below).

## The model

`anthropicModel(options)` calls Claude with structured outputs. The JSON Schema is compiled
from the user's restricted manifest, so most invalid patches can't even be expressed.

| Option              | Default              |                                                                             |
| ------------------- | -------------------- | --------------------------------------------------------------------------- |
| `model`             | `"claude-opus-5-5"`  | Compare models on your own surfaces with the eval set                       |
| `effort`            | `"low"`              | The task is small and tightly constrained, and latency matters              |
| `client` / `apiKey` | `new Anthropic()`    | Reads `ANTHROPIC_API_KEY`                                                   |
| `fallbacks`         | on, except for Haiku | Server-side refusal fallback. Set to `false` on Bedrock, Vertex and Foundry |
| `maxTokens`         | 4096                 |                                                                             |

Calls only happen server-side, so the API key never reaches the browser.

**Bring your own provider** by implementing `ModelAdapter`:

```ts
const myModel: ModelAdapter = {
  id: "acme/model-x",
  async propose({ system, user, outputSchema }) {
    // Return the model's JSON answer: { kind, message, ops }
  },
};
```

The answer is untrusted. Patina validates it, gives the model one repair attempt with the
validator's messages, and otherwise refuses with a readable reason. Throw `ModelRefusal` to
show a message directly.

For tests, `scriptedModel` from `@patina-ui/server/testing` returns canned answers.

### What the model sees

- The rules, and your manifest's descriptions and labels (system prompt, cacheable).
- The **structure** of the user's current view: node IDs, labels, keys and current settings,
  inside a `<current_view>` block marked as data, not instructions.
- The user's request.

It never sees data rows, and it never sees anything `restrict` removed.

## Storage

```ts
interface StorageAdapter {
  list(key): Promise<Entry[]>;
  append(key, entry, expectedSeq): Promise<Entry>; // throws ConflictError if the head moved
  saveProposal(proposal): Promise<void>;
  takeProposal(id, key): Promise<Proposal | null>; // single use, scoped to the user, TTL
}
```

History is **append-only**. Each commit appends a patch together with the user's original
prompt and the model ID. Undo appends a `revert`, and reset appends a `reset`. Both can be
undone themselves. `expectedSeq` provides optimistic concurrency between devices: on
conflict, the handler reloads, re-validates and retries.

`memoryStorage()` keeps everything in-process, for tests and demos.
`postgresStorage({ query })` is for production. It works with any driver, and you set it up
with `migratePostgres(query)`. See [Storage](storage.md) for both, and for prompt retention.

### Layers

The view is resolved as **base → tenant layer → user layer**. The handler writes only the user
layer today. The tenant layer, for org-wide defaults, is read if it exists. It's stored under
`{ layer: "tenant", subjectId: tenantId }`.

## Limits

| Limit                | Default     |                                                                                              |
| -------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `promptMaxChars`     | 500         | Longer prompts get a 400                                                                     |
| `proposalsPerMinute` | 10 per user | In-process. Use your gateway's rate limiting when running several instances. `0` disables it |
| `proposalTtlSeconds` | 900         | How long a preview can still be applied                                                      |
