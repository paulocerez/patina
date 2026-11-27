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

### credentials?

> `optional` **credentials?**: `RequestCredentials`

Cookies: "same-origin" (default) or "include" when the API is on another origin
(e.g. app.example.com calling api.example.com).

#### Inherited from

[`ClientOptions`](ClientOptions.md).[`credentials`](ClientOptions.md#credentials)

***

### endpoint?

> `optional` **endpoint?**: `string`

Where the server handler is mounted, e.g. "/api/patina".

#### Inherited from

[`ClientOptions`](ClientOptions.md).[`endpoint`](ClientOptions.md#endpoint)

***

### fetch?

> `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Custom fetch, e.g. to add auth headers. Defaults to the global fetch.

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

***

### locale?

> `optional` **locale?**: `string`

The user's language ("de", "de-DE", "en"…) for Patina's messages, previews and the model's
replies. Default: the browser's language. Supported: en, de (others fall back to English).

#### Overrides

[`ClientOptions`](ClientOptions.md).[`locale`](ClientOptions.md#locale)

***

### params?

> `optional` **params?**: `Record`\<`string`, `string`\>

Extra query parameters on every request, e.g. `{ accountId }` for the server's getContext.

#### Inherited from

[`ClientOptions`](ClientOptions.md).[`params`](ClientOptions.md#params)
