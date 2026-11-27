[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / ModelAdapter

# Interface: ModelAdapter

A provider-agnostic model. Implementations return the raw JSON answer; Patina validates it.

## Properties

### id

> `readonly` **id**: `string`

e.g. "anthropic/claude-opus-5-5". Stored with each patch.

## Methods

### propose()

> **propose**(`request`, `options?`): `Promise`\<`unknown`\>

`attempt` is 0 for the first answer and 1 for the repair round-trip (when the first answer
didn't validate). Adapters may use it to route the retry elsewhere (see `withBackup`).

#### Parameters

##### request

[`ModelRequest`](../../core/interfaces/ModelRequest.md)

##### options?

###### attempt?

`number`

###### signal?

`AbortSignal`

#### Returns

`Promise`\<`unknown`\>
