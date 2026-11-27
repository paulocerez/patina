[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / StorageAdapter

# Interface: StorageAdapter

## Properties

### dismissNotice?

> `optional` **dismissNotice?**: (`who`, `key`) => `Promise`\<`void`\>

#### Parameters

##### who

[`NoticeTarget`](NoticeTarget.md)

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### linkFollowUp?

> `optional` **linkFollowUp?**: (`link`) => `Promise`\<`void`\>

Optional; enables "it's now possible" notices for shipped follow-ups.

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

### listNotices?

> `optional` **listNotices?**: (`who`) => `Promise`\<[`Notice`](../../core/interfaces/Notice.md)[]\>

Shipped, not yet dismissed notices for one user on one surface.

#### Parameters

##### who

[`NoticeTarget`](NoticeTarget.md)

#### Returns

`Promise`\<[`Notice`](../../core/interfaces/Notice.md)[]\>

***

### shipFollowUp?

> `optional` **shipFollowUp?**: (`key`, `message?`) => `Promise`\<`number`\>

Marks a follow-up as shipped, so everyone who asked sees a notice on the surface where they
asked. Returns how many notices that makes. Idempotent.

#### Parameters

##### key

`string`

##### message?

`string` \| `null`

#### Returns

`Promise`\<`number`\>

## Methods

### append()

> **append**(`key`, `entry`, `expectedSeq`): `Promise`\<[`Entry`](../type-aliases/Entry.md)\>

Appends at `expectedSeq + 1`. Throws `ConflictError` if the head is no longer `expectedSeq`.

#### Parameters

##### key

[`HistoryKey`](HistoryKey.md)

##### entry

[`NewEntry`](../type-aliases/NewEntry.md)

##### expectedSeq

`number`

#### Returns

`Promise`\<[`Entry`](../type-aliases/Entry.md)\>

***

### incrementUsage()?

> `optional` **incrementUsage**(`key`): `Promise`\<`number`\>

Adds one to a usage counter and returns the new total. Needed only for the
`limits.monthlyProposals` quota. `subjectId` is a user id, or "*" for a whole tenant.

#### Parameters

##### key

[`UsageKey`](UsageKey.md)

#### Returns

`Promise`\<`number`\>

***

### list()

> **list**(`key`): `Promise`\<[`Entry`](../type-aliases/Entry.md)[]\>

All entries of one history, ordered by seq.

#### Parameters

##### key

[`HistoryKey`](HistoryKey.md)

#### Returns

`Promise`\<[`Entry`](../type-aliases/Entry.md)[]\>

***

### listRequests()?

> `optional` **listRequests**(`filter`): `Promise`\<[`RequestEvent`](RequestEvent.md)[]\>

Reads the request log, newest first.

#### Parameters

##### filter

[`RequestFilter`](RequestFilter.md)

#### Returns

`Promise`\<[`RequestEvent`](RequestEvent.md)[]\>

***

### logRequest()?

> `optional` **logRequest**(`event`): `Promise`\<`void`\>

Appends to the request log (see `RequestEvent`). Optional; enables insights.

#### Parameters

##### event

[`RequestEvent`](RequestEvent.md)

#### Returns

`Promise`\<`void`\>

***

### saveProposal()

> **saveProposal**(`proposal`): `Promise`\<`void`\>

#### Parameters

##### proposal

[`Proposal`](Proposal.md)

#### Returns

`Promise`\<`void`\>

***

### takeProposal()

> **takeProposal**(`id`, `key`): `Promise`\<[`Proposal`](Proposal.md) \| `null`\>

Returns and deletes a proposal, if it exists, belongs to `key` and has not expired.

#### Parameters

##### id

`string`

##### key

[`HistoryKey`](HistoryKey.md)

#### Returns

`Promise`\<[`Proposal`](Proposal.md) \| `null`\>
