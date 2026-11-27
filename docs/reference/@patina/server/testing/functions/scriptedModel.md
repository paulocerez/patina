[Patina API reference](../../../../README.md) / [@patina/server/testing](../README.md) / scriptedModel

# Function: scriptedModel()

> **scriptedModel**(`answer`): [`ModelAdapter`](../../interfaces/ModelAdapter.md) & `object`

A model that returns scripted answers, for tests and offline demos.
Each answer is raw model output: `{ kind, message, ops }` in the flattened op format.

## Parameters

### answer

(`request`, `prompt`, `call`) => `unknown`

## Returns

[`ModelAdapter`](../../interfaces/ModelAdapter.md) & `object`
