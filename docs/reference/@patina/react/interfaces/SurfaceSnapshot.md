[Patina API reference](../../../README.md) / [@patina/react](../README.md) / SurfaceSnapshot

# Interface: SurfaceSnapshot

## Extended by

- [`UseSurface`](UseSurface.md)

## Properties

### message

> **message**: \{ `kind`: `"refusal"` \| `"clarify"` \| `"error"`; `text`: `string`; \} \| `null`

A refusal or clarifying question from the last request, for the user to read.

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

***

### spec

> **spec**: [`SurfaceSpec`](../../core/interfaces/SurfaceSpec.md) \| `null`

The spec to render: the preview while one is pending, otherwise the saved spec.

***

### state

> **state**: [`SurfaceState`](../../core/interfaces/SurfaceState.md) \| `null`

Last state from the server, or null while loading for the first time.

***

### status

> **status**: [`SurfaceStatus`](../type-aliases/SurfaceStatus.md)
