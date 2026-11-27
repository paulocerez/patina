[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / restrictSpec

# Function: restrictSpec()

> **restrictSpec**(`m`, `spec`): [`SurfaceSpec`](../interfaces/SurfaceSpec.md)

Removes what the restriction took away from a spec (nodes, collection keys, sorts on removed
keys, data queries the user may no longer run), so it is neither rendered nor shown to the
model. Uses the restricted manifest from `restrictManifest`.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

## Returns

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)
