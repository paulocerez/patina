[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / shipFollowUp

# Function: shipFollowUp()

> **shipFollowUp**(`storage`, `key`, `message?`): `Promise`\<`number`\>

Marks a follow-up as shipped: everyone who asked for it sees a notice on the page where they
asked ("You asked for … That's now possible."), until they dismiss it. Pass `message` to use
your own text (e.g. with a pointer to where to find it). Returns the number of notices.

## Parameters

### storage

[`StorageAdapter`](../../interfaces/StorageAdapter.md)

### key

`string`

### message?

`string` \| `null`

## Returns

`Promise`\<`number`\>
