[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / ModelRequest

# Interface: ModelRequest

Everything an adapter needs to make one call.

## Properties

### compactSchema

> **compactSchema**: `Record`\<`string`, `unknown`\>

A much smaller schema for large surfaces: one op shape, values as JSON strings. Use it when
a provider can't compile the precise one. Patina validates the answer either way.

***

### outputSchema

> **outputSchema**: `Record`\<`string`, `unknown`\>

JSON Schema the response must follow: precise (enumerates every valid op).

***

### system

> **system**: `string`

***

### user

> **user**: `string`

The user turn: current view (as data) plus the user's request.
