[Patina API reference](../../../README.md) / [@patina/core](../README.md) / resolve

# Function: resolve()

> **resolve**(`m`, `layers`): [`Resolved`](../interfaces/Resolved.md)

base → (restriction) → each layer's effective patches, in order.
Replay is tolerant: ops that no longer apply are skipped and reported. Never throws.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### layers

readonly [`Layer`](../interfaces/Layer.md)[]

## Returns

[`Resolved`](../interfaces/Resolved.md)
