[Patina API reference](../../../../README.md) / [@patina-ui/server/eval](../README.md) / EvalCase

# Interface: EvalCase

## Properties

### accept?

> `optional` **accept?**: [`EvalKind`](../type-aliases/EvalKind.md)[]

Other outcomes that also count as a pass (e.g. refusal for an ambiguous prompt).

***

### expect

> **expect**: \{ `alternatives?`: [`Op`](../../../core/type-aliases/Op.md)[][]; `kind`: `"patch"`; `ops`: [`Op`](../../../core/type-aliases/Op.md)[]; \} \| \{ `kind`: `"refusal"`; \} \| \{ `kind`: `"clarify"`; \}

For "patch": ops whose *result* the model's patch must reproduce.

#### Union Members

##### Type Literal

\{ `alternatives?`: [`Op`](../../../core/type-aliases/Op.md)[][]; `kind`: `"patch"`; `ops`: [`Op`](../../../core/type-aliases/Op.md)[]; \}

##### alternatives?

> `optional` **alternatives?**: [`Op`](../../../core/type-aliases/Op.md)[][]

Other op lists that are also correct (e.g. using an existing preset instead).

##### kind

> **kind**: `"patch"`

##### ops

> **ops**: [`Op`](../../../core/type-aliases/Op.md)[]

***

##### Type Literal

\{ `kind`: `"refusal"`; \}

***

##### Type Literal

\{ `kind`: `"clarify"`; \}

***

### history?

> `optional` **history?**: [`Op`](../../../core/type-aliases/Op.md)[][]

Patches already saved for the user before the prompt, oldest first.

***

### id

> **id**: `string`

***

### ignoreOrder?

> `optional` **ignoreOrder?**: `boolean`

Compare the result without caring about the order of items (when the prompt doesn't say where).

***

### locale?

> `optional` **locale?**: `string`

The user's language (sent as x-patina-locale), e.g. "de".

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
