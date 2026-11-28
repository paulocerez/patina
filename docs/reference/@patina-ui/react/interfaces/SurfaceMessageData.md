[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / SurfaceMessageData

# Interface: SurfaceMessageData

## Properties

### capabilities?

> `optional` **capabilities?**: [`Capabilities`](../../core/interfaces/Capabilities.md)

answer: what the user can change, narrowed to what they asked about.

***

### kind

> **kind**: `"refusal"` \| `"clarify"` \| `"answer"` \| `"error"` \| `"info"`

***

### options?

> `optional` **options?**: `object`[]

clarify: choices to offer (each is possible); picking one sends its label as the reply.

#### label

> **label**: `string`

***

### text

> **text**: `string`
