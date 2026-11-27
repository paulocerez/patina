[Patina API reference](../../../../README.md) / [@patina/server/eval](../README.md) / EvalResult

# Interface: EvalResult

## Properties

### calls

> **calls**: `number`

Model calls for this case (2 = one repair round-trip).

***

### detail?

> `optional` **detail?**: `string`

Why it failed, or what the model said.

***

### expected

> **expected**: [`EvalKind`](../type-aliases/EvalKind.md)

***

### got

> **got**: [`EvalKind`](../type-aliases/EvalKind.md) \| `"error"`

***

### id

> **id**: `string`

***

### ms

> **ms**: `number`

***

### pass

> **pass**: `boolean`

***

### prompt

> **prompt**: `string`
