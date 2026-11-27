[Patina API reference](../../../README.md) / [@patina/core](../README.md) / compose

# Function: compose()

> **compose**(`a`, `b`): [`Op`](../type-aliases/Op.md)[]

Combines two op lists into one that has the same effect as applying `a` then `b`.
Redundant ops are dropped: repeated sets of one path keep only the last, repeated moves
of one item keep only the last, and an insert followed by a remove of the same item
cancels out (as long as nothing in between was placed relative to that item).

## Parameters

### a

[`Op`](../type-aliases/Op.md)[]

### b

[`Op`](../type-aliases/Op.md)[]

## Returns

[`Op`](../type-aliases/Op.md)[]
