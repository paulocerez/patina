[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / ClientOptions

# Interface: ClientOptions

## Properties

### endpoint

> **endpoint**: `string`

Where the server handler is mounted, e.g. "/api/patina".

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

***

### locale?

> `optional` **locale?**: `string`

Sent as `x-patina-locale`, so messages and previews come back in this language.
