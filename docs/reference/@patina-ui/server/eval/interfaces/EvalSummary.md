[Patina API reference](../../../../README.md) / [@patina-ui/server/eval](../README.md) / EvalSummary

# Interface: EvalSummary

## Properties

### accuracy

> **accuracy**: `number`

***

### byExpected

> **byExpected**: `Record`\<[`EvalKind`](../type-aliases/EvalKind.md), \{ `passed`: `number`; `total`: `number`; \}\>

***

### errors

> **errors**: `number`

***

### latencyMs

> **latencyMs**: `object`

#### p50

> **p50**: `number`

#### p95

> **p95**: `number`

***

### model

> **model**: `string`

***

### passed

> **passed**: `number`

***

### refusalPrecision

> **refusalPrecision**: `number` \| `null`

***

### refusalRecall

> **refusalRecall**: `number` \| `null`

***

### repairRate

> **repairRate**: `number`

***

### total

> **total**: `number`
