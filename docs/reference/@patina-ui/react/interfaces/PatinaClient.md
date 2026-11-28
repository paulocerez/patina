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

> **propose**(`surfaceId`, `prompt`, `thread?`): `Promise`\<[`ProposeResponse`](../../core/type-aliases/ProposeResponse.md)\>

`thread`: the question this prompt answers, so the server reads both together.

#### Parameters

##### surfaceId

`string`

##### prompt

`string`

##### thread?

[`ClarifyThread`](ClarifyThread.md)

#### Returns

`Promise`\<[`ProposeResponse`](../../core/type-aliases/ProposeResponse.md)\>

***

### redo()?

> `optional` **redo**(`surfaceId`, `expectedSeq?`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

Takes back the last undo. Optional for custom clients written before 0.7.

#### Parameters

##### surfaceId

`string`

##### expectedSeq?

`number`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

***

### reset()

> **reset**(`surfaceId`, `expectedSeq?`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

#### Parameters

##### surfaceId

`string`

##### expectedSeq?

`number`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

***

### undo()

> **undo**(`surfaceId`, `expectedSeq?`): `Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>

`expectedSeq`: `SurfaceState.seq` as the user saw it. If the history moved on since (a
second click), the server answers 409 instead of undoing one more step.

#### Parameters

##### surfaceId

`string`

##### expectedSeq?

`number`

#### Returns

`Promise`\<[`SurfaceState`](../../core/interfaces/SurfaceState.md)\>
