[Patina API reference](../../../../README.md) / [@patina-ui/server/anthropic](../README.md) / AnthropicModelOptions

# Interface: AnthropicModelOptions

## Properties

### apiKey?

> `optional` **apiKey?**: `string`

***

### backupModel?

> `optional` **backupModel?**: `string` \| `null`

The model for the repair round-trip (when the first answer doesn't validate) and for when
the first model errors or declines. Default "claude-sonnet-5-5". `null` uses `model` only.

***

### client?

> `optional` **client?**: `Anthropic`

Defaults to `new Anthropic()`, which reads ANTHROPIC_API_KEY (or an `ant auth login` profile).

***

### effort?

> `optional` **effort?**: `"low"` \| `"medium"` \| `"high"` \| `"xhigh"` \| `"max"`

Default "low": the task is small and tightly constrained, and latency matters.

***

### fallbacks?

> `optional` **fallbacks?**: `boolean`

Server-side refusal fallback ("default" routes by refusal category). Default: on for
models that support it (not Haiku). Set to false on Bedrock, Vertex and Foundry.

***

### maxTokens?

> `optional` **maxTokens?**: `number`

Default 4096.

***

### model?

> `optional` **model?**: `string`

The model that answers first. Default "claude-haiku-5-5": fast and inexpensive, and with the
backup below it matched the larger models on the eval set.

***

### schema?

> `optional` **schema?**: `"auto"` \| `"precise"` \| `"compact"`

Which output schema to send. "auto" (default) sends the precise schema and switches to the
compact one if the API can't compile it (large surfaces); "precise" or "compact" force one.
