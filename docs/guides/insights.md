# Insights: what customers ask for

Every customization request is logged with what happened and why. That includes the ones
that couldn't be done, so you can see which features customers actually want.

## What the customer sees

| Situation                             | Example                                                                           | Who writes the text                            | Logged as                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| A change is possible                  | preview of the change, then Apply                                                 | Patina (from the patch)                        | `proposed`, then `applied`                         |
| Outside what the page allows          | _"I can only change how this dashboard is laid out and filtered…"_                | the model, told to say kindly what it _can_ do | `refused`, source `model`, reason = category       |
| The model tried something not allowed | _"“Delete button” isn't something you can add here. You can add: No-shows card."_ | Patina's validator (fixed wording)             | `refused`, source `validator`, reason = issue code |
| Not on their plan or flag             | your `message`, e.g. _"New charts are part of the Pro plan."_                     | you ([Availability](availability.md))          | `unavailable` / `refused`, source `host`           |
| Too vague                             | _"Which table do you mean?"_                                                      | the model                                      | `clarified`                                        |
| Quota used up                         | _"You've used all 20 customization requests for this month."_                     | Patina                                         | `over_quota`                                       |
| The model is down                     | _"The assistant is unavailable right now."_                                       | Patina                                         | `error`                                            |

Messages appear under the prompt box (`<SurfaceMessage>`), and nothing on the page changes.

### What a refusal can reveal

- **The model never sees your data** (rows, values), or anything that `restrict` or the
  permissions removed for this user. It can't reveal hidden columns, other customers or other
  users' data, because it doesn't know they exist.
- **Validator messages** only name things the user is allowed to see, or echo what they typed.
- **The model can paraphrase your manifest's descriptions and labels.** Treat them as visible
  to users and don't put anything confidential in them.

## The request log

One row per request, stored through your storage adapter (Postgres table `patina_requests`):

| Field                                            |                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `at`, `surfaceId`, `userId`, `tenantId`          | when, where, who                                                                    |
| `prompt`                                         | the user's words, **in full** (see Retention)                                       |
| `outcome`                                        | `proposed`, `applied`, `refused`, `clarified`, `unavailable`, `over_quota`, `error` |
| `source`                                         | who decided: `model`, `validator` or `host` (your rules)                            |
| `reason`                                         | why, as a code (below)                                                              |
| `message`                                        | what the user was shown                                                             |
| `proposalId`, `model`, `latencyMs`, `modelCalls` | for debugging and cost (2 calls = one repair round-trip)                            |

**Reason codes**

| Source                      | Codes                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The model tags each refusal | `data_access`, `action`, `new_component`, `styling`, `not_on_page`, `unclear`, `other`, `safety`, `no_change` |
| Patina's validator          | the issue code, e.g. `preset_not_allowed`, `not_customizable`, `invalid_value`, `unknown_key`                 |
| Your rules                  | `customize_off`, `data_views_off`, `quota_user`, `quota_tenant`, `rate_limit`                                 |
| Errors                      | `model_unavailable`, `internal`                                                                               |

Logging is on whenever the storage adapter supports it (`memoryStorage` and
`postgresStorage` both do). Turn it off with `logRequests: false`.

## Sending events to your analytics

```ts
createPatinaHandler({
  // …
  onEvent: (e) =>
    posthog.capture({
      distinctId: e.userId,
      event: `patina_${e.outcome}`,
      properties: { surface: e.surfaceId, reason: e.reason, source: e.source, prompt: e.prompt },
      groups: e.tenantId ? { company: e.tenantId } : undefined,
    }),
});
```

`onEvent` receives exactly what's logged. Errors thrown in it go to `onError` and never affect
the user.

## The report

The report groups requests that couldn't be done by their wording, ignoring case, punctuation
and polite filler, so _"Please add a delete button!"_ and _"add a delete button"_ count as
one. It ranks them by **how many organizations** asked, then how often, because broad demand
matters more than one persistent user. It also breaks down _why_ requests weren't fulfilled.

```
# Patina insights

2026-10-28 to now: **5 requests** from 3 users in 2 organizations.

- Applied: 1 (20%)
- Couldn't be done: 4 (80%)

## Most-requested things that couldn't be done

| Request                           | Times | Orgs | Users | Why            |
|-----------------------------------|------:|-----:|------:|----------------|
| show me other users' appointments |     2 |    2 |     2 | data_access    |
| Add a bar chart of revenue by vet |     1 |    1 |     1 | data_views_off |
| let me export the table           |     1 |    1 |     1 | action         |
```

There are three ways to get it.

**From the command line**, against the database your server writes to:

```sh
npx patina insights --database-url "$DATABASE_URL" --since 30d
npx patina insights --tenant acme --surface orders --format json
```

**From your app**, for your own staff. This enables `GET {basePath}/insights`:

```ts
createPatinaHandler({
  // …
  insights: { allow: (ctx) => ctx.roles.includes("staff") },
});
// GET /api/patina/insights?since=30d&tenant=acme&surface=orders&format=markdown
```

Everyone else gets a 403. The demo shows this as an "Insights" panel for Alice.

**In code**, for your own dashboards:

```ts
import { getInsights, renderInsightsMarkdown, summarizeRequests } from "@patina-ui/server";

const report = await getInsights(storage, { since: "2026-11-01T00:00:00Z", tenantId: "acme" });
```

### Reading it

| You see                                                                              | It usually means                                                                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `preset_not_allowed` / `new_component` for the same thing, across many organizations | build it as a component, and offer it as a preset                                                                             |
| `not_customizable` on a prop                                                         | open that prop in the manifest                                                                                                |
| `data_views_off` from many free-plan organizations                                   | an upsell signal, or a reason to move the feature down a plan                                                                 |
| `data_access`                                                                        | usually fine: customers asking for data they shouldn't see. Check the wording in case it's a real need                        |
| `unclear` / many `clarified`                                                         | improve your manifest's descriptions and labels                                                                               |
| a high `modelCalls` average                                                          | the model often needs its repair round-trip; check descriptions, or try another model with the [eval set](model-and-evals.md) |

## Retention

Prompts are stored in full, because the wording is what makes the report useful. They can
contain personal data, so clear old ones on a schedule:

```ts
await storage.redactPrompts(new Date(Date.now() - 90 * 86_400_000)); // keep 90 days
```

This nulls the prompt text in the request log and in saved customizations alike. Outcomes,
reasons and counts stay, so the report keeps working, just without example wording for older
requests.
