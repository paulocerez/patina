[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / PatinaHandlerOptions

# Interface: PatinaHandlerOptions\<Ctx\>

## Type Parameters

### Ctx

`Ctx` *extends* [`PatinaContext`](PatinaContext.md)

## Properties

### basePath?

> `optional` **basePath?**: `string`

Path the handler is mounted at, e.g. "/api/patina". Default: "".

***

### limits?

> `optional` **limits?**: `object`

#### promptMaxChars?

> `optional` **promptMaxChars?**: `number`

Default 500.

#### proposalsPerMinute?

> `optional` **proposalsPerMinute?**: `number`

Default 10 per user per minute. 0 disables the limit.

#### proposalTtlSeconds?

> `optional` **proposalTtlSeconds?**: `number`

How long a preview can be committed. Default 900 s.

***

### model

> **model**: [`ModelAdapter`](ModelAdapter.md)

***

### storage

> **storage**: [`StorageAdapter`](StorageAdapter.md)

***

### surfaces

> **surfaces**: [`Manifest`](../../core/interfaces/Manifest.md)\<`NoInfer`\<`Ctx`\>\>[]

## Methods

### getContext()

> **getContext**(`request`): `Ctx` \| `Promise`\<`Ctx` \| `null`\> \| `null`

Return the caller's identity from the host session, or null if not signed in (→ 401).

#### Parameters

##### request

`Request`

#### Returns

`Ctx` \| `Promise`\<`Ctx` \| `null`\> \| `null`

***

### onError()?

> `optional` **onError**(`error`): `void`

Called with unexpected errors (they are returned to the client as a generic 500).

#### Parameters

##### error

`unknown`

#### Returns

`void`
