[Patina API reference](../../../README.md) / [@patina/server](../README.md) / ModelAdapter

# Interface: ModelAdapter

A provider-agnostic model. Implementations return the raw JSON answer; Patina validates it.

## Properties

### id

> `readonly` **id**: `string`

e.g. "anthropic/claude-opus-5-5". Stored with each patch.

## Methods

### propose()

> **propose**(`request`, `options?`): `Promise`\<`unknown`\>

#### Parameters

##### request

[`ModelRequest`](../../core/interfaces/ModelRequest.md)

##### options?

###### signal?

`AbortSignal`

#### Returns

`Promise`\<`unknown`\>
