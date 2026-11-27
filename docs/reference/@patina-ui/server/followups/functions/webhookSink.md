[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / webhookSink

# Function: webhookSink()

> **webhookSink**(`options`): [`FollowUpSink`](../interfaces/FollowUpSink.md)

POSTs the follow-ups as JSON to your own endpoint (Zapier, n8n, an internal service).

## Parameters

### options

#### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### headers?

`Record`\<`string`, `string`\>

#### includeRequesters?

`boolean`

Include who asked (tenant and user ids). Default false.

#### url

`string`

## Returns

[`FollowUpSink`](../interfaces/FollowUpSink.md)
