[Patina API reference](../../../README.md) / [@patina/cli](../README.md) / ScannedSource

# Interface: ScannedSource

## Properties

### endpoint

> **endpoint**: `object`

#### method

> **method**: `"GET"`

#### path

> **path**: `string`

***

### evidence

> **evidence**: `string`[]

Where the evidence came from, e.g. "openapi.yaml#/paths/~1api~1orders", "src/types.ts#Order".

***

### fields

> **fields**: `Record`\<`string`, [`ScannedField`](ScannedField.md)\>

Empty when the response type couldn't be determined (a TODO in the catalog draft).

***

### params

> **params**: `string`[]

Query parameters seen on the endpoint.
