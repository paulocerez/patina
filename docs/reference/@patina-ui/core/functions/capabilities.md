[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / capabilities

# Function: capabilities()

> **capabilities**(`m`, `spec`, `options?`): [`Capabilities`](../interfaces/Capabilities.md)

The capabilities for one user: pass the manifest after `restrictManifest` /
`localizeManifest` (and `withoutDataViews` when data views are off) and the spec they see.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### options?

#### dataViews?

`boolean`

## Returns

[`Capabilities`](../interfaces/Capabilities.md)
