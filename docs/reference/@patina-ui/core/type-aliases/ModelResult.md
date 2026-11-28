[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / ModelResult

# Type Alias: ModelResult

> **ModelResult** = \{ `kind`: `"patch"`; `ops`: [`Op`](Op.md)[]; `summary`: `string`; \} \| \{ `category`: [`RefusalCategory`](RefusalCategory.md); `detail`: [`ModelRefusalDetail`](../interfaces/ModelRefusalDetail.md) \| `null`; `kind`: `"refusal"`; `reason`: `string`; \} \| \{ `kind`: `"clarify"`; `options`: `object`[]; `question`: `string`; \} \| \{ `detail`: [`ModelRefusalDetail`](../interfaces/ModelRefusalDetail.md) \| `null`; `kind`: `"answer"`; `text`: `string`; \}

## Union Members

### Type Literal

\{ `kind`: `"patch"`; `ops`: [`Op`](Op.md)[]; `summary`: `string`; \}

***

### Type Literal

\{ `category`: [`RefusalCategory`](RefusalCategory.md); `detail`: [`ModelRefusalDetail`](../interfaces/ModelRefusalDetail.md) \| `null`; `kind`: `"refusal"`; `reason`: `string`; \}

***

### Type Literal

\{ `kind`: `"clarify"`; `options`: `object`[]; `question`: `string`; \}

#### kind

> **kind**: `"clarify"`

#### options

> **options**: `object`[]

Each option's ops (validated by the handler before anything is shown).

#### question

> **question**: `string`

***

### Type Literal

\{ `detail`: [`ModelRefusalDetail`](../interfaces/ModelRefusalDetail.md) \| `null`; `kind`: `"answer"`; `text`: `string`; \}

The user asked what is possible. The handler answers from the manifest, not this text.
