[Patina API reference](../../../README.md) / [@patina/core](../README.md) / validate

# Function: validate()

> **validate**(`m`, `spec`, `patch`): [`Issue`](../interfaces/Issue.md)[]

Validates a patch against the manifest and the spec it will apply to.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### patch

[`Op`](../type-aliases/Op.md)[] \| `Pick`\<[`Patch`](../interfaces/Patch.md), `"ops"`\>

## Returns

[`Issue`](../interfaces/Issue.md)[]
