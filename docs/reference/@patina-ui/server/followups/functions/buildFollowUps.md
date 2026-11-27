[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / buildFollowUps

# Function: buildFollowUps()

> **buildFollowUps**(`events`, `options`): `Promise`\<\{ `considered`: `number`; `followUps`: [`FollowUp`](../interfaces/FollowUp.md)[]; \}\>

Groups unmet requests into follow-ups. Pure apart from the grouper and `customerName`.

## Parameters

### events

[`RequestEvent`](../../interfaces/RequestEvent.md)[]

### options

`Omit`\<[`FollowUpOptions`](../interfaces/FollowUpOptions.md), `"storage"` \| `"sinks"` \| `"dryRun"`\> & `object`

## Returns

`Promise`\<\{ `considered`: `number`; `followUps`: [`FollowUp`](../interfaces/FollowUp.md)[]; \}\>
