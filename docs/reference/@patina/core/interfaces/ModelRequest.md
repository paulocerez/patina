[Patina API reference](../../../README.md) / [@patina/core](../README.md) / ModelRequest

# Interface: ModelRequest

Everything an adapter needs to make one call.

## Properties

### outputSchema

> **outputSchema**: `Record`\<`string`, `unknown`\>

JSON Schema the response must follow.

***

### system

> **system**: `string`

***

### user

> **user**: `string`

The user turn: current view (as data) plus the user's request.
