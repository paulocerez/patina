[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / SurfaceStore

# Class: SurfaceStore

Framework-agnostic state for one surface. React subscribes via useSyncExternalStore.

## Constructors

### Constructor

> **new SurfaceStore**(`client`, `surfaceId`): `SurfaceStore`

#### Parameters

##### client

[`PatinaClient`](../interfaces/PatinaClient.md)

##### surfaceId

`string`

#### Returns

`SurfaceStore`

## Properties

### surfaceId

> `readonly` **surfaceId**: `string`

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

### getSnapshot()

> **getSnapshot**(): [`SurfaceSnapshot`](../interfaces/SurfaceSnapshot.md)

#### Returns

[`SurfaceSnapshot`](../interfaces/SurfaceSnapshot.md)

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

### subscribe()

> **subscribe**(`listener`): () => `boolean`

#### Parameters

##### listener

() => `void`

#### Returns

() => `boolean`

***

### undo()

> **undo**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
