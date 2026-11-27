[Patina API reference](../../../../README.md) / [@patina-ui/server/eval](../README.md) / EvalCase

# Interface: EvalCase

## Properties

### accept?

> `optional` **accept?**: [`EvalKind`](../type-aliases/EvalKind.md)[]

Other outcomes that also count as a pass (e.g. refusal for an ambiguous prompt).

***

### expect

> **expect**: \{ `kind`: `"patch"`; `ops`: [`Op`](../../../core/type-aliases/Op.md)[]; \} \| \{ `kind`: `"refusal"`; \} \| \{ `kind`: `"clarify"`; \}

For "patch": ops whose *result* the model's patch must reproduce.

***

### history?

> `optional` **history?**: [`Op`](../../../core/type-aliases/Op.md)[][]

Patches already saved for the user before the prompt, oldest first.

***

### id

> **id**: `string`

***

### note?

> `optional` **note?**: `string`

***

### prompt

> **prompt**: `string`

***

### user?

> `optional` **user?**: `string`

Key into `contexts`. Defaults to the first context.
