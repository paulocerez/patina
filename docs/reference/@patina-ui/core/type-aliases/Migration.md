[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / Migration

# Type Alias: Migration

> **Migration** = (`op`, `spec`) => [`Op`](Op.md) \| `null`

Rewrites one op written against an older base version. Return the op (possibly changed)
or `null` to drop it on purpose. `spec` is the spec the op is about to be applied to.

## Parameters

### op

[`Op`](Op.md)

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

## Returns

[`Op`](Op.md) \| `null`
