[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / buildOutputSchema

# Function: buildOutputSchema()

> **buildOutputSchema**(`m`, `spec`, `options?`): `Json`

Compiles the JSON Schema for the model's answer from the (restricted) manifest and the
current spec. Node IDs, props, keys and values are enumerated, so most invalid patches
cannot even be expressed. Ops are flattened (no tuples) to stay inside the schema subset
that structured outputs support.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### options?

[`SchemaOptions`](../interfaces/SchemaOptions.md) = `{}`

## Returns

`Json`
