[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / ProposeResponse

# Type Alias: ProposeResponse

> **ProposeResponse** = \{ `changes`: [`Change`](../interfaces/Change.md)[]; `kind`: `"proposal"`; `ops`: [`Op`](Op.md)[]; `previewSpec`: [`SurfaceSpec`](../interfaces/SurfaceSpec.md); `proposalId`: `string`; `summary`: `string`; \} \| \{ `kind`: `"refusal"`; `message`: `string`; \} \| \{ `kind`: `"clarify"`; `question`: `string`; \}

Body of POST /surfaces/:id/proposals.

## Union Members

### Type Literal

\{ `changes`: [`Change`](../interfaces/Change.md)[]; `kind`: `"proposal"`; `ops`: [`Op`](Op.md)[]; `previewSpec`: [`SurfaceSpec`](../interfaces/SurfaceSpec.md); `proposalId`: `string`; `summary`: `string`; \}

#### changes

> **changes**: [`Change`](../interfaces/Change.md)[]

Generated from the ops, not by the model. Show these in the preview.

#### kind

> **kind**: `"proposal"`

#### ops

> **ops**: [`Op`](Op.md)[]

#### previewSpec

> **previewSpec**: [`SurfaceSpec`](../interfaces/SurfaceSpec.md)

#### proposalId

> **proposalId**: `string`

#### summary

> **summary**: `string`

***

### Type Literal

\{ `kind`: `"refusal"`; `message`: `string`; \}

***

### Type Literal

\{ `kind`: `"clarify"`; `question`: `string`; \}
