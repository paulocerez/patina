[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / RequestEvent

# Interface: RequestEvent

One row of the request log: the record of what customers asked for and what happened.

## Properties

### at

> **at**: `string`

ISO timestamp.

***

### detail?

> `optional` **detail?**: `RequestDetail` \| `null`

Structured detail, for grouping and counting without reading prompts:
- refusals: `{ node, component, wanted, field? }` (e.g. node "recentCalls", wanted "summary";
  `field` when the catalog has the field but it is sensitive or restricted),
- replies to a clarifying question: `thread: { prompt, question }`,
- answers: `scope` (the parts of the page asked about).
Null when there is nothing to add. Older adapters may omit it.

***

### id

> **id**: `string`

***

### latencyMs

> **latencyMs**: `number` \| `null`

***

### message

> **message**: `string` \| `null`

What the user was shown.

***

### model

> **model**: `string` \| `null`

***

### modelCalls

> **modelCalls**: `number` \| `null`

2 means the model needed its one retry (repair, or a second look at a refusal).

***

### outcome

> **outcome**: [`RequestOutcome`](../type-aliases/RequestOutcome.md)

***

### prompt

> **prompt**: `string` \| `null`

The user's words. Cleared by `redactPrompts` after your retention period.

***

### proposalId

> **proposalId**: `string` \| `null`

***

### reason

> **reason**: `string` \| `null`

Why, as a code. Refusals by the model use its category (missing_field, missing_setting,
missing_value, data_access, action, new_component, styling, not_on_page, unclear, other,
safety, no_change); proposals the refusal guard rescued use `rescued:<category>` (the model
refused something the manifest allows: add the prompt to your evals); refusals by the validator use the
issue code (preset_not_allowed, not_customizable, …); the host's rules use customize_off,
data_views_off, quota_user, quota_tenant, rate_limit; errors use model_unavailable or internal.

***

### source

> **source**: `"model"` \| `"validator"` \| `"host"` \| `"guard"` \| `null`

Who decided: the model, Patina's validator, the host's own rules, or the refusal guard (a
deterministic check that overrode a model refusal of something the manifest allows).

***

### surfaceId

> **surfaceId**: `string`

***

### tenantId

> **tenantId**: `string` \| `null`

***

### userId

> **userId**: `string`
