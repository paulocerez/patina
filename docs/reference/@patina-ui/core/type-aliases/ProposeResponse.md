[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / ProposeResponse

# Type Alias: ProposeResponse

> **ProposeResponse** = \{ `changes`: [`Change`](../interfaces/Change.md)[]; `kind`: `"proposal"`; `ops`: [`Op`](Op.md)[]; `previewSpec`: [`SurfaceSpec`](../interfaces/SurfaceSpec.md); `proposalId`: `string`; `summary`: `string`; \} \| \{ `category?`: `string`; `kind`: `"refusal"`; `message`: `string`; \} \| \{ `kind`: `"clarify"`; `options?`: `object`[]; `question`: `string`; \} \| \{ `capabilities`: [`Capabilities`](../interfaces/Capabilities.md); `kind`: `"answer"`; `message`: `string`; `question`: `string`; \}

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

\{ `category?`: `string`; `kind`: `"refusal"`; `message`: `string`; \}

#### category?

> `optional` **category?**: `string`

Why (see `REFUSAL_CATEGORIES`), when known.

#### kind

> **kind**: `"refusal"`

#### message

> **message**: `string`

***

### Type Literal

\{ `kind`: `"clarify"`; `options?`: `object`[]; `question`: `string`; \}

#### kind

> **kind**: `"clarify"`

#### options?

> `optional` **options?**: `object`[]

Choices the user can pick, each checked to be possible. Send the picked label (or any
reply) back as the next prompt with `thread: { prompt, question }`.

#### question

> **question**: `string`

***

### Type Literal

\{ `capabilities`: [`Capabilities`](../interfaces/Capabilities.md); `kind`: `"answer"`; `message`: `string`; `question`: `string`; \}

#### capabilities

> **capabilities**: [`Capabilities`](../interfaces/Capabilities.md)

What the user can change, narrowed to what they asked about.

#### kind

> **kind**: `"answer"`

The user asked what is possible: answered from the manifest, not by the model.

#### message

> **message**: `string`

#### question

> **question**: `string`

Same as `message`, so clients from before 0.7 (which show `question`) show it too.
