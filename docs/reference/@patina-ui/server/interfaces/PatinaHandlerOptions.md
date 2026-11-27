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

### insights?

> `optional` **insights?**: `object`

Enables `GET {basePath}/insights` for the users you allow (e.g. your own staff): a report of
what customers asked for, what was refused and why. See docs/guides/insights.md.

#### allow()

> **allow**(`ctx`): `boolean` \| `Promise`\<`boolean`\>

##### Parameters

###### ctx

`NoInfer`\<`Ctx`\>

##### Returns

`boolean` \| `Promise`\<`boolean`\>

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

#### monthlyProposals()?

> `optional` **monthlyProposals**(`ctx`): \{ `tenant?`: `number`; `user?`: `number`; \} \| `null` \| `undefined`

Monthly quota of customization requests (each one is a model call), per user and/or per
tenant. Return undefined for no limit. Needs a storage adapter with `incrementUsage`.

  monthlyProposals: (ctx) => (ctx.plan === "pro" ? { user: 500 } : { user: 20, tenant: 200 })

##### Parameters

###### ctx

`NoInfer`\<`Ctx`\>

##### Returns

\{ `tenant?`: `number`; `user?`: `number`; \} \| `null` \| `undefined`

***

### logRequests?

> `optional` **logRequests?**: `boolean`

Store the request log through the storage adapter (if it supports it). Default true.

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

### availability()?

> `optional` **availability**(`ctx`, `surfaceId`): [`AvailabilityRule`](AvailabilityRule.md) \| `Promise`\<[`AvailabilityRule`](AvailabilityRule.md)\>

Who may customize, per user and surface. Called on every request; can be async, so it can
ask a feature-flag service or your billing. Default: everything on.

  availability: async (ctx) => ({
    customize: await flags.isEnabled("patina", ctx),
    dataViews: ctx.plan !== "free",
  })

#### Parameters

##### ctx

`NoInfer`\<`Ctx`\>

##### surfaceId

`string`

#### Returns

[`AvailabilityRule`](AvailabilityRule.md) \| `Promise`\<[`AvailabilityRule`](AvailabilityRule.md)\>

***

### getContext()

> **getContext**(`request`): `Ctx` \| `Promise`\<`Ctx` \| `null`\> \| `null`

Return the caller's identity from the host session, or null if not signed in (→ 401).

#### Parameters

##### request

`Request`

#### Returns

`Ctx` \| `Promise`\<`Ctx` \| `null`\> \| `null`

***

### locale()?

> `optional` **locale**(`ctx`, `request`): `string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

The user's language for Patina's messages, previews and the model's replies. Default: the
`x-patina-locale` header (sent by <PatinaProvider locale>), then Accept-Language, then
English. Supported: en, de; host labels can be given per language.

#### Parameters

##### ctx

`NoInfer`\<`Ctx`\>

##### request

`Request`

#### Returns

`string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

***

### onError()?

> `optional` **onError**(`error`): `void`

Called with unexpected errors (they are returned to the client as a generic 500).

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### onEvent()?

> `optional` **onEvent**(`event`): `void` \| `Promise`\<`void`\>

Called once per customization request with what happened (proposed, applied, refused,
clarified, unavailable, over_quota, error) and why. Forward it to your analytics.
Errors thrown here are reported to onError and never affect the user.

#### Parameters

##### event

[`RequestEvent`](RequestEvent.md)

#### Returns

`void` \| `Promise`\<`void`\>
