[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / FollowUpLinks

# Interface: FollowUpLinks

Follow-ups and the users who asked for them, so they can be told when it ships.

## Methods

### dismissNotice()

> **dismissNotice**(`who`, `key`): `Promise`\<`void`\>

#### Parameters

##### who

[`NoticeTarget`](NoticeTarget.md)

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### linkFollowUp()

> **linkFollowUp**(`link`): `Promise`\<`void`\>

Records (or refreshes) who asked for a follow-up. Called by `runFollowUps` after delivery.

#### Parameters

##### link

###### key

`string`

###### requesters

[`NoticeTarget`](NoticeTarget.md)[]

###### title

`string`

#### Returns

`Promise`\<`void`\>

***

### listNotices()

> **listNotices**(`who`): `Promise`\<[`Notice`](../../core/interfaces/Notice.md)[]\>

Shipped, not yet dismissed notices for one user on one surface.

#### Parameters

##### who

[`NoticeTarget`](NoticeTarget.md)

#### Returns

`Promise`\<[`Notice`](../../core/interfaces/Notice.md)[]\>

***

### shipFollowUp()

> **shipFollowUp**(`key`, `message?`): `Promise`\<`number`\>

Marks a follow-up as shipped, so everyone who asked sees a notice on the surface where they
asked. Returns how many notices that makes. Idempotent.

#### Parameters

##### key

`string`

##### message?

`string` \| `null`

#### Returns

`Promise`\<`number`\>
