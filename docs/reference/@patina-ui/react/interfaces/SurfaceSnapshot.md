[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / SurfaceSnapshot

# Interface: SurfaceSnapshot

## Extended by

- [`UseSurface`](UseSurface.md)

## Properties

### message

> **message**: [`SurfaceMessageData`](SurfaceMessageData.md) \| `null`

What the last request said back, for the user to read: a refusal, a clarifying question
(with the options it offers), an answer to "what can I …?" (with the capabilities it
lists), an error, or "info" for a reply kind this version doesn't know.

***

### notices

> **notices**: [`Notice`](../../core/interfaces/Notice.md)[]

Things this user asked for earlier that are now possible (from the last load).

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
