[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / PatinaProviderProps

# Interface: PatinaProviderProps

## Extends

- `Partial`\<[`ClientOptions`](ClientOptions.md)\>

## Properties

### children

> **children**: `ReactNode`

***

### client?

> `optional` **client?**: [`PatinaClient`](PatinaClient.md)

Use a custom client instead of `endpoint`/`fetch` (e.g. in tests).

***

### endpoint?

> `optional` **endpoint?**: `string`

Where the server handler is mounted, e.g. "/api/patina".

#### Inherited from

[`ClientOptions`](ClientOptions.md).[`endpoint`](ClientOptions.md#endpoint)

***

### fetch?

> `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Custom fetch, e.g. to add auth headers. Defaults to the global fetch with cookies.

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

#### Inherited from

[`ClientOptions`](ClientOptions.md).[`fetch`](ClientOptions.md#fetch)

***

### fetchSource?

> `optional` **fetchSource?**: [`FetchSource`](../type-aliases/FetchSource.md)

How data blocks load catalog sources. Defaults to a same-origin GET with cookies.
