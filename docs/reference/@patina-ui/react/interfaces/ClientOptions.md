[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / ClientOptions

# Interface: ClientOptions

## Properties

### credentials?

> `optional` **credentials?**: `RequestCredentials`

Cookies: "same-origin" (default) or "include" when the API is on another origin
(e.g. app.example.com calling api.example.com).

***

### endpoint

> **endpoint**: `string`

Where the server handler is mounted, e.g. "/api/patina".

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

***

### locale?

> `optional` **locale?**: `string`

Sent as the `locale` query parameter, so messages and previews come back in this language.
(A query parameter, not a header, so cross-origin APIs need no CORS change.)

***

### params?

> `optional` **params?**: `Record`\<`string`, `string`\>

Extra query parameters on every request, e.g. `{ accountId }` for the server's getContext.
