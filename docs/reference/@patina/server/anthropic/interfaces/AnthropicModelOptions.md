[Patina API reference](../../../../README.md) / [@patina/server/anthropic](../README.md) / AnthropicModelOptions

# Interface: AnthropicModelOptions

## Properties

### apiKey?

> `optional` **apiKey?**: `string`

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

Default "claude-opus-5-5". Use the eval set to compare models for your surfaces.
