[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / rescueRefusal

# Function: rescueRefusal()

> **rescueRefusal**(`m`, `spec`, `prompt`, `refusal`): [`Rescue`](../type-aliases/Rescue.md) \| `null`

Checks a refusal against the manifest. Returns a proposal or a clarifying question when the
prompt names something that is allowed, or null when the refusal stands.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### prompt

`string`

### refusal

[`RefusalInfo`](../interfaces/RefusalInfo.md)

## Returns

[`Rescue`](../type-aliases/Rescue.md) \| `null`
