[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / diffProps

# Function: diffProps()

> **diffProps**(`m`, `nodeId`, `component`, `from`, `to`): [`Op`](../type-aliases/Op.md)[]

Ops that turn `from` props into `to` props for one node (customizable props only).

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### nodeId

`string`

### component

`string`

### from

`Record`\<`string`, [`Value`](../type-aliases/Value.md)\>

### to

`Record`\<`string`, [`Value`](../type-aliases/Value.md)\>

## Returns

[`Op`](../type-aliases/Op.md)[]
