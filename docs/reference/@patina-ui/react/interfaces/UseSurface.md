[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / UseSurface

# Interface: UseSurface

## Extends

- [`SurfaceSnapshot`](SurfaceSnapshot.md)

## Properties

### availability

> **availability**: `object`

What this user may do (from the server's `availability` hook). Customizing defaults to
allowed while the first state is loading.

#### customize

> **customize**: `boolean`

#### dataViews

> **dataViews**: `boolean`

#### message?

> `optional` **message?**: `string`

***

### busy

> **busy**: `boolean`

***

### canUndo

> **canUndo**: `boolean`

***

### isCustomized

> **isCustomized**: `boolean`

***

### message

> **message**: \{ `kind`: `"refusal"` \| `"clarify"` \| `"error"`; `text`: `string`; \} \| `null`

A refusal or clarifying question from the last request, for the user to read.

#### Inherited from

[`SurfaceSnapshot`](SurfaceSnapshot.md).[`message`](SurfaceSnapshot.md#message)

***

### notices

> **notices**: [`Notice`](../../core/interfaces/Notice.md)[]

Things this user asked for earlier that are now possible (from the last load).

#### Inherited from

[`SurfaceSnapshot`](SurfaceSnapshot.md).[`notices`](SurfaceSnapshot.md#notices)

***

### proposal

> **proposal**: \{ `changes`: [`Change`](../../core/interfaces/Change.md)[]; `kind`: `"proposal"`; `ops`: [`Op`](../../core/type-aliases/Op.md)[]; `previewSpec`: [`SurfaceSpec`](../../core/interfaces/SurfaceSpec.md); `proposalId`: `string`; `summary`: `string`; \} \| `null`

#### Union Members

##### Type Literal

\{ `changes`: [`Change`](../../core/interfaces/Change.md)[]; `kind`: `"proposal"`; `ops`: [`Op`](../../core/type-aliases/Op.md)[]; `previewSpec`: [`SurfaceSpec`](../../core/interfaces/SurfaceSpec.md); `proposalId`: `string`; `summary`: `string`; \}

##### changes

> **changes**: [`Change`](../../core/interfaces/Change.md)[]

Generated from the ops, not by the model. Show these in the preview.

##### kind

> **kind**: `"proposal"`

##### ops

> **ops**: [`Op`](../../core/type-aliases/Op.md)[]

##### previewSpec

> **previewSpec**: [`SurfaceSpec`](../../core/interfaces/SurfaceSpec.md)

##### proposalId

> **proposalId**: `string`

##### summary

> **summary**: `string`

***

`null`

#### Inherited from

[`SurfaceSnapshot`](SurfaceSnapshot.md).[`proposal`](SurfaceSnapshot.md#proposal)

***

### spec

> **spec**: [`SurfaceSpec`](../../core/interfaces/SurfaceSpec.md) \| `null`

The spec to render: the preview while one is pending, otherwise the saved spec.

#### Inherited from

[`SurfaceSnapshot`](SurfaceSnapshot.md).[`spec`](SurfaceSnapshot.md#spec)

***

### state

> **state**: [`SurfaceState`](../../core/interfaces/SurfaceState.md) \| `null`

Last state from the server, or null while loading for the first time.

#### Inherited from

[`SurfaceSnapshot`](SurfaceSnapshot.md).[`state`](SurfaceSnapshot.md#state)

***

### status

> **status**: [`SurfaceStatus`](../type-aliases/SurfaceStatus.md)

#### Inherited from

[`SurfaceSnapshot`](SurfaceSnapshot.md).[`status`](SurfaceSnapshot.md#status)

## Methods

### commit()

> **commit**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### discard()

> **discard**(): `void`

#### Returns

`void`

***

### dismissNotice()

> **dismissNotice**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### propose()

> **propose**(`prompt`): `Promise`\<`void`\>

#### Parameters

##### prompt

`string`

#### Returns

`Promise`\<`void`\>

***

### reload()

> **reload**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### undo()

> **undo**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
