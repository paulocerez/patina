[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / getInsights

# Function: getInsights()

> **getInsights**(`storage`, `filter?`): `Promise`\<[`InsightsReport`](../interfaces/InsightsReport.md)\>

Reads the request log and summarizes it. Needs a storage adapter with `listRequests`.

## Parameters

### storage

[`StorageAdapter`](../interfaces/StorageAdapter.md)

### filter?

[`RequestFilter`](../interfaces/RequestFilter.md) = `{}`

## Returns

`Promise`\<[`InsightsReport`](../interfaces/InsightsReport.md)\>
