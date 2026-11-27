[Patina API reference](../../../README.md) / @patina-ui/server/integrations

# @patina-ui/server/integrations

Event integrations: forward Patina's request events to PostHog and its errors to Sentry.
Plug the results into `createPatinaHandler({ onEvent, onError })`. No SDK dependencies:
pass your own PostHog or Sentry client, or use PostHog's HTTP API.

## Interfaces

- [PostHogClientLike](interfaces/PostHogClientLike.md)
- [SentryLike](interfaces/SentryLike.md)
- [SentryReporterOptions](interfaces/SentryReporterOptions.md)

## Type Aliases

- [EventHandler](type-aliases/EventHandler.md)
- [PostHogEventsOptions](type-aliases/PostHogEventsOptions.md)

## Functions

- [combineEvents](functions/combineEvents.md)
- [posthogEvents](functions/posthogEvents.md)
- [posthogProperties](functions/posthogProperties.md)
- [sentryReporter](functions/sentryReporter.md)
