[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / PatinaClient

# Interface: PatinaClient

## Methods

### commit()

> **commit**(`surfaceId`, `proposalId`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

#### Parameters

##### surfaceId

`string`

##### proposalId

`string`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

***

### dismissNotice()?

> `optional` **dismissNotice**(`surfaceId`, `key`): `Promise`\<`void`\>

Hides a "now possible" notice for good.

#### Parameters

##### surfaceId

`string`

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`surfaceId`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

#### Parameters

##### surfaceId

`string`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

***

### propose()

> **propose**(`surfaceId`, `prompt`): `Promise`\<[`ProposeResponse`](../../core/type-aliases/ProposeResponse.md)\>

#### Parameters

##### surfaceId

`string`

##### prompt

`string`

#### Returns

`Promise`\<[`ProposeResponse`](../../core/type-aliases/ProposeResponse.md)\>

***

### reset()

> **reset**(`surfaceId`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

#### Parameters

##### surfaceId

`string`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

***

### undo()

> **undo**(`surfaceId`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

#### Parameters

##### surfaceId

`string`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>
