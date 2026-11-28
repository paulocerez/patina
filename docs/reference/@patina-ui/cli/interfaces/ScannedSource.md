[Patina API reference](../../../README.md) / [@patina-ui/cli](../README.md) / ScannedSource

# Interface: ScannedSource

## Properties

### dateRange?

> `optional` **dateRange?**: `object`

Query params that look like a date range's start and end.

#### from

> **from**: `string`

#### to

> **to**: `string`

***

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

### paging?

> `optional` **paging?**: \{ `limit`: `string`; `offset`: `string`; `style`: `"offset"`; \} \| \{ `page`: `string`; `pageSize`: `string`; `style`: `"page"`; \} \| \{ `cursor`: `string`; `style`: `"cursor"`; \}

How the endpoint pages, guessed from its query params.

***

### params

> **params**: `string`[]

Query parameters seen on the endpoint.

***

### pathParams?

> `optional` **pathParams?**: `string`[]

Tenant placeholders in the path (`/api/accounts/:accountId/…`), filled by the fetch layer.

***

### rows?

> `optional` **rows?**: `string`

Where the rows are in the response when it wraps them (`res.json({ items, total })`).
