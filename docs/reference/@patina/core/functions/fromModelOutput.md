[Patina API reference](../../../README.md) / [@patina/core](../README.md) / fromModelOutput

# Function: fromModelOutput()

> **fromModelOutput**(`raw`, `newKey?`): [`ModelResult`](../type-aliases/ModelResult.md)

Converts the model's flattened answer into a `ModelResult`. Insert keys are generated
here, never by the model. The ops are still untrusted: always `validate` them.

## Parameters

### raw

`unknown`

### newKey?

() => `string`

## Returns

[`ModelResult`](../type-aliases/ModelResult.md)
