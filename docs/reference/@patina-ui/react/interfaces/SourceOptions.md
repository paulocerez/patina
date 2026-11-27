[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / SourceOptions

# Interface: SourceOptions

## Extended by

- [`FetchSourceOptions`](FetchSourceOptions.md)

## Properties

### baseUrl?

> `optional` **baseUrl?**: `string`

Prepended to every path, e.g. "https://api.example.com". Default: same origin.

***

### credentials?

> `optional` **credentials?**: `RequestCredentials`

***

### dateRange?

> `optional` **dateRange?**: [`DateRangeMapping`](DateRangeMapping.md)

Turns a relative range param into the endpoint's own start and end.

***

### headers?

> `optional` **headers?**: `Record`\<`string`, `string`\> \| (() => `Record`\<`string`, `string`\>)

***

### maxPages?

> `optional` **maxPages?**: `number`

Safety cap on pages per request. Default 50.

***

### paging?

> `optional` **paging?**: [`Paging`](../type-aliases/Paging.md)

***

### params?

> `optional` **params?**: `Record`\<`string`, `string` \| `number` \| `boolean` \| `undefined`\>

Sent with every request (e.g. the current tenant: `{ accountId }`). A path placeholder
with the same name (`/api/accounts/:accountId/orders`) is filled in instead.

***

### rows?

> `optional` **rows?**: `string`

Where the rows are in the response: "items", "data.rows". Default: the body if it's an array, else rows/data/items/results.
