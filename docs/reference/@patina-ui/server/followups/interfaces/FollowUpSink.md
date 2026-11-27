[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / FollowUpSink

# Interface: FollowUpSink

Where follow-ups go. Implement it for Jira, GitHub Issues, email, a webhook…

## Properties

### name

> **name**: `string`

## Methods

### deliver()

> **deliver**(`items`, `earlier`): `Promise`\<[`Delivery`](Delivery.md)[]\>

Receives this run's follow-ups and the deliveries of the sinks before it (so a Slack digest
can link the Linear issues). Sinks run in the order given.

#### Parameters

##### items

[`FollowUp`](FollowUp.md)[]

##### earlier

[`Delivery`](Delivery.md)[]

#### Returns

`Promise`\<[`Delivery`](Delivery.md)[]\>

***

### known()?

> `optional` **known**(): `Promise`\<[`KnownFollowUp`](KnownFollowUp.md)[]\>

Follow-ups this sink already has (e.g. open Linear issues), for grouping and de-duplication.

#### Returns

`Promise`\<[`KnownFollowUp`](KnownFollowUp.md)[]\>
