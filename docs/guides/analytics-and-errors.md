# Analytics and errors: PostHog and Sentry

Every customization request produces one event (`onEvent`), and unexpected failures go to
`onError`. `@patina-ui/server/integrations` forwards both to PostHog and Sentry. It pulls in
no SDK: pass the client you already have, or use PostHog's HTTP API.

## PostHog

```ts
import { PostHog } from "posthog-node";
import { posthogEvents } from "@patina-ui/server/integrations";

const posthog = new PostHog(process.env.POSTHOG_KEY!, { host: "https://eu.i.posthog.com" });

createPatinaHandler({
  // …
  onEvent: posthogEvents({ client: posthog, groupType: "company" }),
});
```

Without posthog-node, pass the project API key and Patina posts to PostHog's capture endpoint:

```ts
onEvent: posthogEvents({ apiKey: process.env.POSTHOG_KEY!, host: "https://eu.i.posthog.com" });
```

The default host is PostHog's EU cloud. Use `https://us.i.posthog.com` or your own instance.

Each request becomes one `patina request` event with these properties:

| Property                             | Value                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `surface_id`                         | which view                                                                                      |
| `outcome`                            | `proposed`, `applied`, `refused`, `clarified`, `answered`, `unavailable`, `over_quota`, `error` |
| `reason`, `source`                   | why, and who decided (see [Insights](insights.md#the-request-log))                              |
| `detail_node`, `detail_wanted`       | what a refusal was about, e.g. `recentCalls` / `summary` (when known)                           |
| `model`, `latency_ms`, `model_calls` | cost and speed                                                                                  |
| `proposal_id`, `tenant_id`           | to follow one request from preview to apply, and to filter per customer                         |

**Options:**

- `groupType`: with the group type you already use for customers, such as `"company"`, events
  are attached to the tenant's group, so you can break down usage per customer and plan.
- `distinctId`: by default the event is about `ctx.userId`. Pass a function if PostHog knows
  your users by another id.
- `event`: the event name.

**Privacy defaults:** the prompt is **not** sent; turn it on with `includePrompt: true`. If you
also run with `logRequests: false`, turn it on: otherwise no prompt is recorded anywhere and
you can't tell what users asked for. Events
are sent with `$process_person_profile: false`, so PostHog doesn't create or update person
profiles for them. Set `personProfiles: true` if you want it to.

With feature flags in PostHog, you can compare the outcomes per flag cohort. For example, check
how many requests are refused before you roll customizing out to everyone.

## Sentry

```ts
import * as Sentry from "@sentry/node";
import { sentryReporter } from "@patina-ui/server/integrations";

const sentry = sentryReporter(Sentry);

createPatinaHandler({
  // …
  onError: sentry.onError,
  onEvent: sentry.onEvent,
});
```

- **`onError`:** unexpected errors are sent with `captureException`, tagged
  `component: patina`. The user sees a generic error message.
- **`onEvent`:** reports only requests with outcome `error`, as one message per request:
  - `Patina: model_unavailable` is a **warning**: the model API was unreachable, and Patina told
    the user to try again.
  - `Patina: internal` is an **error**.
  - The tags are `surface`, `reason` and `model`. The request id and latency go in `extra`.

Refusals are not errors, so they don't go to Sentry. Watch them in [Insights](insights.md) or
PostHog instead. Prompts are never sent to Sentry. The user id is sent only with
`sentryReporter(Sentry, { includeUser: true })`.

## Both at once

`onEvent` takes one function. `combineEvents` runs several:

```ts
import { combineEvents, posthogEvents, sentryReporter } from "@patina-ui/server/integrations";

const sentry = sentryReporter(Sentry);

createPatinaHandler({
  // …
  onEvent: combineEvents(posthogEvents({ client: posthog, groupType: "company" }), sentry.onEvent),
  onError: sentry.onError,
});
```

Every handler runs even if another one fails. Failures are passed to `onError` together as one
`AggregateError` and never affect the user's request.

The handler waits for `onEvent` before it responds. posthog-node batches in the background, so
it doesn't add latency, but the HTTP mode makes one request per event. On a busy app, use
posthog-node, and call `posthog.shutdown()` when the server stops so the last batch is sent.
