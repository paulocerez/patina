[Patina API reference](../../../../README.md) / [@patina-ui/server/anthropic](../README.md) / anthropicGrouper

# Function: anthropicGrouper()

> **anthropicGrouper**(`options?`): [`FollowUpGrouper`](../../followups/type-aliases/FollowUpGrouper.md)

A follow-up grouper using Claude: merges requests that want the same thing (any wording or
language), matches them to follow-ups already filed, and writes ticket titles.
Only the redacted request texts, counts and reason codes are sent.

## Parameters

### options?

[`AnthropicGrouperOptions`](../interfaces/AnthropicGrouperOptions.md) = `{}`

## Returns

[`FollowUpGrouper`](../../followups/type-aliases/FollowUpGrouper.md)
