[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / FetchSourceOptions

# Interface: FetchSourceOptions

## Extends

- [`SourceOptions`](SourceOptions.md)

## Properties

### baseUrl?

> `optional` **baseUrl?**: `string`

Prepended to every path, e.g. "https://api.example.com". Default: same origin.

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`baseUrl`](SourceOptions.md#baseurl)

***

### credentials?

> `optional` **credentials?**: `RequestCredentials`

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`credentials`](SourceOptions.md#credentials)

***

### dateRange?

> `optional` **dateRange?**: [`DateRangeMapping`](DateRangeMapping.md)

Turns a relative range param into the endpoint's own start and end.

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`dateRange`](SourceOptions.md#daterange)

***

### fetch?

> `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`RequestInfo` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` \| `Request` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

***

### headers?

> `optional` **headers?**: `Record`\<`string`, `string`\> \| (() => `Record`\<`string`, `string`\>)

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`headers`](SourceOptions.md#headers)

***

### maxPages?

> `optional` **maxPages?**: `number`

Safety cap on pages per request. Default 50.

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`maxPages`](SourceOptions.md#maxpages)

***

### now?

> `optional` **now?**: () => `Date`

For tests.

#### Returns

`Date`

***

### paging?

> `optional` **paging?**: [`Paging`](../type-aliases/Paging.md)

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`paging`](SourceOptions.md#paging)

***

### params?

> `optional` **params?**: `Record`\<`string`, `string` \| `number` \| `boolean` \| `undefined`\>

Sent with every request (e.g. the current tenant: `{ accountId }`). A path placeholder
with the same name (`/api/accounts/:accountId/orders`) is filled in instead.

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`params`](SourceOptions.md#params)

***

### rows?

> `optional` **rows?**: `string`

Where the rows are in the response: "items", "data.rows". Default: the body if it's an array, else rows/data/items/results.

#### Inherited from

[`SourceOptions`](SourceOptions.md).[`rows`](SourceOptions.md#rows)

***

### sources?

> `optional` **sources?**: `Record`\<`string`, [`SourceOptions`](SourceOptions.md)\>

Per catalog source, merged over the options above.
