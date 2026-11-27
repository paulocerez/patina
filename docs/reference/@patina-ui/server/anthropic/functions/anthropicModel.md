[Patina API reference](../../../../README.md) / [@patina-ui/server/anthropic](../README.md) / anthropicModel

# Function: anthropicModel()

> **anthropicModel**(`options?`): [`ModelAdapter`](../../interfaces/ModelAdapter.md)

Anthropic implementation of `ModelAdapter`, using structured outputs with the JSON Schema
compiled from the manifest. Runs server-side only: the API key never reaches the browser.

By default Claude Haiku 5.5 answers and Claude Sonnet 5.5 is the backup (see `backupModel`).

## Parameters

### options?

[`AnthropicModelOptions`](../interfaces/AnthropicModelOptions.md) = `{}`

## Returns

[`ModelAdapter`](../../interfaces/ModelAdapter.md)
