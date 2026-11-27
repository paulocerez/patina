[Patina API reference](../../../../README.md) / [@patina-ui/server/integrations](../README.md) / posthogEvents

# Function: posthogEvents()

> **posthogEvents**(`options`): [`EventHandler`](../type-aliases/EventHandler.md)

An `onEvent` that sends every customization request to PostHog: outcome, reason, surface,
model and latency. Prompts are not sent unless `includePrompt` is set.

  onEvent: posthogEvents({ client: posthog, groupType: "company" })

## Parameters

### options

[`PostHogEventsOptions`](../type-aliases/PostHogEventsOptions.md)

## Returns

[`EventHandler`](../type-aliases/EventHandler.md)
