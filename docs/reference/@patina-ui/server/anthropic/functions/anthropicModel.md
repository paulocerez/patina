[Patina API reference](../../../../README.md) / [@patina-ui/server/anthropic](../README.md) / anthropicModel

# Function: anthropicModel()

> **anthropicModel**(`options?`): [`ModelAdapter`](../../interfaces/ModelAdapter.md)

Anthropic implementation of `ModelAdapter`, using structured outputs with the JSON Schema
compiled from the manifest. Runs server-side only: the API key never reaches the browser.

## Parameters

### options?

[`AnthropicModelOptions`](../interfaces/AnthropicModelOptions.md) = `{}`

## Returns

[`ModelAdapter`](../../interfaces/ModelAdapter.md)
