[Patina API reference](../../../README.md) / [@patina/react](../README.md) / FetchSource

# Type Alias: FetchSource

> **FetchSource** = (`request`) => `Promise`\<`unknown`\>

Fetches rows for a catalog source. The default calls the source's GET endpoint with the
user's cookies. Pass your own to go through your data layer (React Query, auth headers…).

## Parameters

### request

#### params

`Record`\<`string`, `string`\>

#### path

`string`

#### signal

`AbortSignal`

#### source

`string`

## Returns

`Promise`\<`unknown`\>
