[Patina API reference](../../../../README.md) / [@patina-ui/server/eval](../README.md) / EvalResult

# Interface: EvalResult

## Properties

### calls

> **calls**: `number`

Model calls for this case (2 = one retry: repair or a second look at a refusal).

***

### category?

> `optional` **category?**: `string` \| `null`

For refusals: the category and detail the request log got.

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
