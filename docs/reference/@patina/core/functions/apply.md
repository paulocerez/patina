[Patina API reference](../../../README.md) / [@patina/core](../README.md) / apply

# Function: apply()

> **apply**(`m`, `spec`, `patch`, `mode?`): [`ApplyResult`](../interfaces/ApplyResult.md)

Applies a patch.

- `strict` (authoring, commit): if any op is invalid, nothing is applied and every
  problem is reported in `skipped`.
- `tolerant` (replay): invalid ops are skipped and reported; the rest apply.

Never throws, whatever the input.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### patch

[`Op`](../type-aliases/Op.md)[] \| `Pick`\<[`Patch`](../interfaces/Patch.md), `"ops"`\>

### mode?

[`ApplyMode`](../type-aliases/ApplyMode.md) = `"strict"`

## Returns

[`ApplyResult`](../interfaces/ApplyResult.md)
