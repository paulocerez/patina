[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / invert

# Function: invert()

> **invert**(`m`, `specBefore`, `patch`): [`Op`](../type-aliases/Op.md)[]

Returns the ops that undo `patch` when applied to the result of applying it to
`specBefore`. Ops that would not apply are ignored (they changed nothing).

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### specBefore

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### patch

[`Op`](../type-aliases/Op.md)[] \| `Pick`\<[`Patch`](../interfaces/Patch.md), `"ops"`\>

## Returns

[`Op`](../type-aliases/Op.md)[]
