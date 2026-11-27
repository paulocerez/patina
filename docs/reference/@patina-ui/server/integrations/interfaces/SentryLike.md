[Patina API reference](../../../../README.md) / [@patina-ui/server/integrations](../README.md) / SentryLike

# Interface: SentryLike

The part of the Sentry SDK (`@sentry/node`, `@sentry/bun`, …) Patina uses.

## Methods

### captureException()

> **captureException**(`error`, `context?`): `unknown`

#### Parameters

##### error

`unknown`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`unknown`

***

### captureMessage()

> **captureMessage**(`message`, `context?`): `unknown`

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`unknown`
