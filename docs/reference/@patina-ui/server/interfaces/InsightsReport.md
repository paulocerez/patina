[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / InsightsReport

# Interface: InsightsReport

## Properties

### appliedRate

> **appliedRate**: `number` \| `null`

Share of requests that ended with a change applied.

***

### customers

> **customers**: `object`

#### tenants

> **tenants**: `number`

#### users

> **users**: `number`

***

### outcomes

> **outcomes**: `Record`\<[`RequestOutcome`](../type-aliases/RequestOutcome.md), `number`\>

***

### period

> **period**: `object`

#### since

> **since**: `string` \| `null`

#### until

> **until**: `string` \| `null`

***

### reasons

> **reasons**: [`ReasonCount`](ReasonCount.md)[]

Why requests weren't fulfilled: refusals, unavailability, quotas, errors.

***

### requests

> **requests**: `number`

Customization requests (prompts), not counting the later "applied" events.

***

### rescued

> **rescued**: `object`[]

Requests the model refused although the manifest allowed them (the refusal guard proposed
or asked instead). Each one is a model mistake: add it to your evals.

#### at

> **at**: `string`

#### prompt

> **prompt**: `string`

#### reason

> **reason**: `string`

***

### suggestions

> **suggestions**: `ManifestSuggestion`[]

Manifest changes that would make refused requests possible, from the refusals' structured
detail (missing_field, missing_setting, missing_value), most-asked first.

***

### surfaces

> **surfaces**: `object`[]

#### applied

> **applied**: `number`

#### requests

> **requests**: `number`

#### surfaceId

> **surfaceId**: `string`

#### unmet

> **unmet**: `number`

***

### truncated

> **truncated**: `boolean`

True if the log had more rows than were read; narrow the period for exact numbers.

***

### unmet

> **unmet**: [`UnmetRequest`](UnmetRequest.md)[]

The most-asked things that couldn't be done, grouped by (normalized) wording.

***

### unmetRate

> **unmetRate**: `number` \| `null`

Share of requests that couldn't be done (refused or unavailable).
