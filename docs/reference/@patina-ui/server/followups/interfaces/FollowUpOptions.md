[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / FollowUpOptions

# Interface: FollowUpOptions

## Properties

### dryRun?

> `optional` **dryRun?**: `boolean`

Compute and return the follow-ups without calling any sink's `deliver`.

***

### grouper?

> `optional` **grouper?**: [`FollowUpGrouper`](../type-aliases/FollowUpGrouper.md)

***

### link?

> `optional` **link?**: `boolean`

Remember who asked for each delivered follow-up, so they can be told when it ships
(`shipFollowUp`, `followUpWebhook`). Default: on if the storage supports it.

***

### maxItems?

> `optional` **maxItems?**: `number`

At most this many follow-ups per run, most customers first. Default 10.

***

### minCustomers?

> `optional` **minCustomers?**: `number`

Minimum distinct customers. Default 1.

***

### minRequests?

> `optional` **minRequests?**: `number`

Minimum requests in the window for a follow-up. Default 2.

***

### now?

> `optional` **now?**: () => `number`

#### Returns

`number`

***

### reasons?

> `optional` **reasons?**: `string`[]

Reason codes to include. Default `DEMAND_REASONS`.

***

### since?

> `optional` **since?**: `string`

Start of the window, ISO. Default: 7 days ago. Match it to how often you run this.

***

### sinks

> **sinks**: [`FollowUpSink`](FollowUpSink.md)[]

***

### storage

> **storage**: [`StorageAdapter`](../../interfaces/StorageAdapter.md)

***

### surfaceId?

> `optional` **surfaceId?**: `string`

***

### until?

> `optional` **until?**: `string`

## Methods

### customerName()?

> `optional` **customerName**(`tenantId`): `string` \| `Promise`\<`string` \| `null`\> \| `null`

Customer names for tickets, from a tenant id (your CRM or accounts table). Off by default:
tickets then say "3 customers" without naming them.

#### Parameters

##### tenantId

`string`

#### Returns

`string` \| `Promise`\<`string` \| `null`\> \| `null`

***

### redact()?

> `optional` **redact**(`prompt`): `string` \| `null`

Cleans prompt text before it leaves your system. Default `redact`: removes email addresses,
URLs, phone and long account numbers. Return null to leave an example out.

#### Parameters

##### prompt

`string`

#### Returns

`string` \| `null`
