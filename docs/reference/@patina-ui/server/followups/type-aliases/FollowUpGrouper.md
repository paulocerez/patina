[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / FollowUpGrouper

# Type Alias: FollowUpGrouper

> **FollowUpGrouper** = (`clusters`, `known`) => `Promise`\<[`FollowUpGroup`](../interfaces/FollowUpGroup.md)[]\>

Merges clusters that ask for the same thing (different wordings or languages) and writes
titles. Without one, each wording is its own follow-up. See `anthropicGrouper`.

## Parameters

### clusters

[`RequestCluster`](../interfaces/RequestCluster.md)[]

### known

[`KnownFollowUp`](../interfaces/KnownFollowUp.md)[]

## Returns

`Promise`\<[`FollowUpGroup`](../interfaces/FollowUpGroup.md)[]\>
