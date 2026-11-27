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
