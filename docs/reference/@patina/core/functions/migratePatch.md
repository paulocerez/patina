[Patina API reference](../../../README.md) / [@patina/core](../README.md) / migratePatch

# Function: migratePatch()

> **migratePatch**(`m`, `patch`, `spec`): `object`

Runs a stored patch through every migration between its base version and the
manifest's current version. Never rewrites storage: migration happens on read.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### patch

[`Patch`](../interfaces/Patch.md)

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

## Returns

`object`

### patch

> **patch**: [`Patch`](../interfaces/Patch.md)

### skipped

> **skipped**: [`Skip`](../interfaces/Skip.md)[]
