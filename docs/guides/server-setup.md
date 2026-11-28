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

Works with ESM and CommonJS (`require`), including TypeScript's older `moduleResolution: node`
setting, and with `@anthropic-ai/sdk` 0.90 or newer.

**No API key in this environment?** `anthropicModel()` doesn't throw: the page still renders,
and customizing is off with a short message ("Customizing isn't set up here yet."). So you
can deploy everywhere and set `ANTHROPIC_API_KEY` only where you want it.

## Who gets it

`availability(ctx, surfaceId)` turns customizing and data views on or off per user, from
feature flags, plans or anything else. `limits.monthlyProposals(ctx)` sets monthly quotas.
The view always renders, and users who lose access keep their saved changes by default. See
[Availability](availability.md).

## Language

Messages, previews and the model's replies follow the user's language: the `locale(ctx,
request)` hook, else the `locale` query parameter (sent by `<PatinaProvider locale>`), else `Accept-Language`. English and German
are built in. See [Localization](localization.md).

## What customers ask for

Every request is logged with its outcome and reason, including refusals. `onEvent(e)` forwards
each event to your analytics, and `insights: { allow }` serves a report to your staff at
`GET {basePath}/insights`. See [Insights](insights.md).

> With `logRequests: false` (or a storage adapter without a request log, such as
> `postgresStorage({ requestLog: false })`) **no prompt is stored anywhere**: you can't find out
> what users asked for. Set `onEvent` and include `prompt` and `message`:
>
> ```ts
> onEvent: (e) => analytics.track("patina_request", {
>   outcome: e.outcome, reason: e.reason, prompt: e.prompt, message: e.message, detail: e.detail,
> }),
> ```
>
> The handler logs a one-line warning at startup when neither the log nor `onEvent` is on.

## How a request is answered

1. **"What can I …?"** questions (_"Was kann ich bei den letzten Anrufen anzeigen?"_, _"Which
   columns can I add?"_) are answered from the manifest, scoped to the part of the page named,
   with no model call (`kind: "answer"`, outcome `answered`).
2. Otherwise the model answers with a patch, a refusal, a clarifying question, or an answer.
3. **A refusal gets a second look.** Every refusal except `safety` is sent back once, to the
   backup model, with the refusal and the relevant part of the manifest: allowed values with
   their labels in the user's language, collection keys, insertable presets and data fields.
   A patch that doesn't validate gets the same single retry (repair). Never more than 2 calls.
4. **The refusal guard** runs before any refusal by the model reaches the user. If the prompt names an
   allowed value of a setting the refusal is about (_"Standard-Zeitraum auf Heute"_) or a column
   that is only hidden, Patina proposes it, or asks which one when several match. It is
   deterministic and logged as source `guard`, reason `rescued:<category>`.
5. **Clarifying questions only offer what's possible.** Each option the model offers comes with
   its ops, and options whose ops don't validate are dropped. The reply is sent with the
   original request and the question (`thread`), and a reply can't get a second question.

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

| Option              | Default               |                                                                                                                                            |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`             | `"claude-haiku-5-5"`  | The model that answers first                                                                                                               |
| `backupModel`       | `"claude-sonnet-5-5"` | Takes the repair round-trip, errors and safety declines; `null` for a single model                                                         |
| `effort`            | `"low"`               | The task is small and tightly constrained, and latency matters                                                                             |
| `client` / `apiKey` | `new Anthropic()`     | Reads `ANTHROPIC_API_KEY`                                                                                                                  |
| `fallbacks`         | on, except for Haiku  | Server-side refusal fallback. Set to `false` on Bedrock, Vertex and Foundry                                                                |
| `maxTokens`         | 4096                  |                                                                                                                                            |
| `schema`            | `"auto"`              | `"auto"` tries the precise output schema and falls back to the compact one if the API can't compile it; or force `"precise"` / `"compact"` |

Calls only happen server-side, so the API key never reaches the browser.

Pair any two adapters with `withBackup(primary, backup)` from `@patina-ui/server`.

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
prompt and the model ID. Undo appends a `revert`, and reset appends a `reset`. A reset can be
undone, and **redo** (`POST {basePath}/surfaces/:id/redo`) takes back the last undo by appending
a revert of that revert (a new change ends the redo chain). `expectedSeq` provides optimistic
concurrency between devices: on conflict, the handler reloads, re-validates and retries.

**Undo can't run away.** `SurfaceState.seq` is the user's history position. The React client
sends it as `{ expectedSeq }` with undo, redo and reset. If the history moved on (a second click
sent before the first one's answer arrived, or another tab), the server answers **409** instead
of undoing one more step. Clients that send no `expectedSeq` (before 0.7) work as before. The
React store also ignores history actions while a request is in flight.

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
