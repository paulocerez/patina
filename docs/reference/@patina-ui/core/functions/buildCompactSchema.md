[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / buildCompactSchema

# Function: buildCompactSchema()

> **buildCompactSchema**(`m`, `spec`, `options?`): `Json`

A compact output schema: a single op shape with node and prop as enums, everything else as
strings, and values as JSON text. Small enough for any surface; the allowed values per prop
are spelled out in the system prompt instead.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### options?

[`SchemaOptions`](../interfaces/SchemaOptions.md) = `{}`

## Returns

`Json`
