[Patina API reference](../../../README.md) / [@patina/core](../README.md) / SurfaceState

# Interface: SurfaceState

Body of GET /surfaces/:id and of successful commit, undo and reset.

## Properties

### canUndo

> **canUndo**: `boolean`

***

### catalog?

> `optional` **catalog?**: [`Catalog`](Catalog.md)

The user's data sources (restricted, no sensitive fields), for data blocks.

***

### isCustomized

> **isCustomized**: `boolean`

***

### render

> **render**: `object`

Which props are slots and which are collections, per component, for the renderer.

#### collections

> **collections**: `Record`\<`string`, `string`[]\>

#### slots

> **slots**: `Record`\<`string`, `string`[]\>

***

### skipped

> **skipped**: `object`[]

Earlier changes that no longer apply.

#### message

> **message**: `string`

#### patchId?

> `optional` **patchId?**: `string`

***

### spec

> **spec**: [`SurfaceSpec`](SurfaceSpec.md)

***

### surfaceId

> **surfaceId**: `string`
