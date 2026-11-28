[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / scopeCapabilities

# Function: scopeCapabilities()

> **scopeCapabilities**(`caps`, `m`, `spec`, `text`): `object`

Narrows capabilities to the parts of the page a prompt names (by label or ID). Data is
narrowed to the source behind a named table's columns, if it has one. Returns everything
when nothing is named.

## Parameters

### caps

[`Capabilities`](../interfaces/Capabilities.md)

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### text

`string`

## Returns

`object`

### caps

> **caps**: [`Capabilities`](../interfaces/Capabilities.md)

### scope

> **scope**: `string`[]
