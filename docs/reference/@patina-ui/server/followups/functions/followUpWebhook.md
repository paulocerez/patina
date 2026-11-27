[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / followUpWebhook

# Function: followUpWebhook()

> **followUpWebhook**(`options`): (`request`) => `Promise`\<`Response`\>

A fetch-style handler for your tracker's webhook. When a follow-up's issue is completed,
it marks the follow-up as shipped (see `shipFollowUp`). Issues closed as not planned or
canceled are ignored.

- Linear: Settings → API → Webhooks, data type "Issues"; signature header `linear-signature`.
- GitHub: repository webhook, event "Issues", content type JSON; header `x-hub-signature-256`.
- Jira Cloud: admin webhook for "Issue updated" with a secret; header `x-hub-signature`.

It needs the raw request body: with Express, mount it before `express.json()`.

## Parameters

### options

[`FollowUpWebhookOptions`](../interfaces/FollowUpWebhookOptions.md)

## Returns

(`request`) => `Promise`\<`Response`\>
