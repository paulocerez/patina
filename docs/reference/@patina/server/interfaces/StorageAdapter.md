[Patina API reference](../../../README.md) / [@patina/server](../README.md) / StorageAdapter

# Interface: StorageAdapter

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

### list()

> **list**(`key`): `Promise`\<[`Entry`](../type-aliases/Entry.md)[]\>

All entries of one history, ordered by seq.

#### Parameters

##### key

[`HistoryKey`](HistoryKey.md)

#### Returns

`Promise`\<[`Entry`](../type-aliases/Entry.md)[]\>

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
