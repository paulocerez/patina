# Availability: who gets to customize

You decide per customer, per user and per view whether Patina is available. You can base it
on feature flags, plans, roles or anything else you know about the request. It's one hook on
the server:

```ts
createPatinaHandler({
  // …
  availability: async (ctx, surfaceId) => ({
    customize: await flags.isEnabled("patina", ctx), // the whole feature
    dataViews: ctx.plan !== "free", // new charts, tables and cards
    message: ctx.plan === "free" ? "New charts are part of the Pro plan." : undefined,
  }),
  limits: {
    monthlyProposals: (ctx) => (ctx.plan === "pro" ? { user: 500 } : { tenant: 50 }),
  },
});
```

`availability` runs on every request, with the context from your `getContext` and the
surface's ID. It can be async, so it can call a flag service or your billing. Every field is
optional, and everything is on by default.

| Field       | Default            | Effect when `false`                                                                                    |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `customize` | `true`             | The user can't change this view: no prompt, apply, undo or reset                                       |
| `dataViews` | `true`             | The user can't create or edit [data views](data-views.md), but can still rearrange, hide and configure |
| `whenOff`   | `"keep"`           | What users who lose access see (below)                                                                 |
| `message`   | a generic sentence | What the user is told, e.g. "Upgrade to Pro to customize this dashboard"                               |

## What the user sees

- **The view always renders.** Availability only controls _changing_ it. `GET` always returns
  the view, now with an `availability` field.
- **The built-in UI hides itself.** `PromptInput`, `UndoButton` and `ResetButton` render
  nothing when customizing is off. `<AvailabilityNotice>` shows your `message`.
  `useSurface(id).availability` gives you `{ customize, dataViews, message }` for your own UI.
- **The server enforces it, not the UI.** Changes are refused with a 403 and your message.
  Without data views, the model isn't even told about data sources or block presets, and
  requests for them get your message.

## When a customer loses access

For example after a downgrade, a flag rollback, or a trial that ended:

| `whenOff`          | Their view                       | Their saved customizations                            |
| ------------------ | -------------------------------- | ----------------------------------------------------- |
| `"keep"` (default) | stays the way they customized it | kept and shown, but they can't make new changes       |
| `"base"`           | back to the default view         | kept in storage, hidden, and back when access returns |

This applies to both switches. With `dataViews: false`:

- **keep**: data views they built before still show;
- **base**: they're hidden.

Choose per surface by returning a different `whenOff` depending on `surfaceId`.

## Feature-flag providers

The hook takes any async function, so Patina needs no SDK. Some examples:

```ts
// LaunchDarkly
availability: async (ctx) => ({
  customize: await ld.variation("patina", { kind: "user", key: ctx.userId, organization: ctx.tenantId }, false),
}),

// PostHog
availability: async (ctx) => ({
  customize: (await posthog.isFeatureEnabled("patina", ctx.userId, { groups: { company: ctx.tenantId ?? "" } })) ?? false,
}),

// Unleash
availability: (ctx) => ({
  customize: unleash.isEnabled("patina", { userId: ctx.userId, properties: { tenantId: ctx.tenantId ?? "" } }),
}),

// OpenFeature (any provider)
availability: async (ctx) => ({
  customize: await OpenFeature.getClient().getBooleanValue("patina", false, { targetingKey: ctx.userId }),
}),

// Plain conditions
availability: (ctx, surfaceId) => ({
  customize: ctx.roles.includes("admin") || surfaceId !== "billing.overview",
  dataViews: ctx.plan === "pro" && ctx.trialEndsAt > Date.now(),
}),
```

The hook runs on every Patina request. If your flag lookup is slow, cache it, as your SDK
probably already does.

## Quotas

`limits.monthlyProposals(ctx)` returns `{ user?, tenant? }`: how many customization
requests (model calls) a user, or a whole tenant, may make per calendar month. Return
`undefined` for no limit. Past the limit, requests get a 429 with a readable message, and the
model isn't called. Counting needs a storage adapter with `incrementUsage`. Both
`memoryStorage` and `postgresStorage` have it, and the latter uses the `patina_usage` table.

The per-minute limit (`proposalsPerMinute`, default 10) still applies on top of this.

## Finer control

`availability` switches capabilities on and off. To change _what_ may be customized for a
customer, use `restrict(ctx)` on the surface. It runs per request with the same context and
can remove columns, nodes, presets and catalog sources or fields:

```ts
restrict: (ctx) => (ctx.plan === "pro" ? {} : { presets: ["stat.forecast"], sources: ["invoices"] }),
```

See [Defining a surface](define-a-surface.md#permissions-restrict) and
[Permissions and safety](permissions-and-safety.md).
