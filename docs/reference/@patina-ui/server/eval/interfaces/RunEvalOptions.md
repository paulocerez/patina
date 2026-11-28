[Patina API reference](../../../../README.md) / [@patina-ui/server/eval](../README.md) / RunEvalOptions

# Interface: RunEvalOptions\<Ctx\>

## Type Parameters

### Ctx

`Ctx` *extends* [`PatinaContext`](../../interfaces/PatinaContext.md)

## Properties

### concurrency?

> `optional` **concurrency?**: `number`

***

### contexts

> **contexts**: `Record`\<`string`, `Ctx`\>

Request contexts by name, e.g. { alice: {...}, bob: {...} }.

***

### model?

> `optional` **model?**: [`ModelAdapter`](../../interfaces/ModelAdapter.md)

Not needed with `scripted`.

***

### scripted?

> `optional` **scripted?**: `boolean`

Answer every model call from the case's `script` instead of a model: tests the
deterministic parts (validation, the refusal guard, answers, clarification checks) in CI.

***

### surface

> **surface**: [`Manifest`](../../../core/interfaces/Manifest.md)\<`NoInfer`\<`Ctx`\>\>

## Methods

### onResult()?

> `optional` **onResult**(`result`): `void`

#### Parameters

##### result

[`EvalResult`](EvalResult.md)

#### Returns

`void`
