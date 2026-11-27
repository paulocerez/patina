[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / RequestEvent

# Interface: RequestEvent

One row of the request log: the record of what customers asked for and what happened.

## Properties

### at

> **at**: `string`

ISO timestamp.

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

2 means the model needed its one repair round-trip.

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

Why, as a code. Refusals by the model use its category (data_access, action, new_component,
styling, not_on_page, unclear, other, safety, no_change); refusals by the validator use the
issue code (preset_not_allowed, not_customizable, …); the host's rules use customize_off,
data_views_off, quota_user, quota_tenant, rate_limit; errors use model_unavailable or internal.

***

### source

> **source**: `"model"` \| `"validator"` \| `"host"` \| `null`

Who decided: the model, Patina's validator, or the host's own rules.

***

### surfaceId

> **surfaceId**: `string`

***

### tenantId

> **tenantId**: `string` \| `null`

***

### userId

> **userId**: `string`
