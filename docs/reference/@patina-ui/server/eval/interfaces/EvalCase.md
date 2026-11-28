[Patina API reference](../../../../README.md) / [@patina-ui/server/eval](../README.md) / EvalCase

# Interface: EvalCase

## Properties

### accept?

> `optional` **accept?**: [`EvalKind`](../type-aliases/EvalKind.md)[]

Other outcomes that also count as a pass (e.g. refusal for an ambiguous prompt).

***

### expect

> **expect**: \{ `alternatives?`: [`Op`](../../../core/type-aliases/Op.md)[][]; `kind`: `"patch"`; `ops`: [`Op`](../../../core/type-aliases/Op.md)[]; \} \| \{ `category?`: `string`; `detail?`: \{ `node?`: `string`; `wanted?`: `string`; \}; `kind`: `"refusal"`; \} \| \{ `kind`: `"clarify"`; `optionsMax?`: `number`; `optionsMin?`: `number`; \} \| \{ `kind`: `"answer"`; `mentions?`: `string`[]; \}

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

\{ `category?`: `string`; `detail?`: \{ `node?`: `string`; `wanted?`: `string`; \}; `kind`: `"refusal"`; \}

##### category?

> `optional` **category?**: `string`

The refusal category it must have (e.g. "missing_field").

##### detail?

> `optional` **detail?**: `object`

Detail it must have (as stored in the request log), e.g. { node: "recentCalls", wanted: "summary" }.

###### detail.node?

> `optional` **node?**: `string`

###### detail.wanted?

> `optional` **wanted?**: `string`

##### kind

> **kind**: `"refusal"`

***

##### Type Literal

\{ `kind`: `"clarify"`; `optionsMax?`: `number`; `optionsMin?`: `number`; \}

##### kind

> **kind**: `"clarify"`

##### optionsMax?

> `optional` **optionsMax?**: `number`

At most this many options (every option offered must be possible).

##### optionsMin?

> `optional` **optionsMin?**: `number`

At least this many options.

***

##### Type Literal

\{ `kind`: `"answer"`; `mentions?`: `string`[]; \}

##### kind

> **kind**: `"answer"`

##### mentions?

> `optional` **mentions?**: `string`[]

Labels the answer must mention (e.g. column names).

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

### script?

> `optional` **script?**: `unknown`[]

Raw model outputs, one per call, for `runEval(…, { scripted: true })`: replays a model's
answers (good or bad) to test what Patina does with them, without an API key.

***

### thread?

> `optional` **thread?**: `object`

The question this prompt answers: sent as `thread`, like the React client does.

#### prompt

> **prompt**: `string`

#### question

> **question**: `string`

***

### user?

> `optional` **user?**: `string`

Key into `contexts`. Defaults to the first context.
