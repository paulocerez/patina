[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / FollowUpWebhookOptions

# Interface: FollowUpWebhookOptions

## Properties

### now?

> `optional` **now?**: () => `number`

#### Returns

`number`

***

### provider

> **provider**: `"linear"` \| `"github"` \| `"jira"`

Which tracker calls this webhook.

***

### secret

> **secret**: `string`

The webhook's signing secret. Requests without a valid signature get a 401.

***

### storage

> **storage**: [`StorageAdapter`](../../interfaces/StorageAdapter.md)

## Methods

### message()?

> `optional` **message**(`shipped`): `string` \| `null` \| `undefined`

Your own notice text per shipped follow-up; default: Patina's localized text.

#### Parameters

##### shipped

###### key

`string`

###### title

`string`

###### url?

`string`

#### Returns

`string` \| `null` \| `undefined`

***

### onShipped()?

> `optional` **onShipped**(`shipped`): `void` \| `Promise`\<`void`\>

Called after a follow-up was marked shipped.

#### Parameters

##### shipped

###### key

`string`

###### notices

`number`

#### Returns

`void` \| `Promise`\<`void`\>
