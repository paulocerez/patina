[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / FollowUpRun

# Interface: FollowUpRun

## Properties

### considered

> **considered**: `number`

Unmet requests in the window with a matching reason.

***

### deliveries

> **deliveries**: [`Delivery`](Delivery.md)[]

***

### errors

> **errors**: `object`[]

Sinks that failed, with the error; the other sinks still ran.

#### error

> **error**: `string`

#### sink

> **sink**: `string`

***

### followUps

> **followUps**: [`FollowUp`](FollowUp.md)[]

***

### truncated

> **truncated**: `boolean`

***

### window

> **window**: `object`

#### since

> **since**: `string`

#### until

> **until**: `string`
