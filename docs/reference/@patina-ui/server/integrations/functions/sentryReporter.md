[Patina API reference](../../../../README.md) / [@patina-ui/server/integrations](../README.md) / sentryReporter

# Function: sentryReporter()

> **sentryReporter**(`sentry`, `options?`): `object`

Reports unexpected errors (`onError`) and failed requests (`onEvent`, outcome "error": the
model was unreachable or something broke) to Sentry. Prompts are never sent.

  const sentry = sentryReporter(Sentry);
  createPatinaHandler({ onError: sentry.onError, onEvent: sentry.onEvent, … })

## Parameters

### sentry

[`SentryLike`](../interfaces/SentryLike.md)

### options?

[`SentryReporterOptions`](../interfaces/SentryReporterOptions.md) = `{}`

## Returns

`object`

### onEvent

> **onEvent**: [`EventHandler`](../type-aliases/EventHandler.md)

### onError()

> **onError**(`error`): `void`

#### Parameters

##### error

`unknown`

#### Returns

`void`
