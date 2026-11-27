[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / FollowUp

# Interface: FollowUp

One thing customers want that the product doesn't offer yet.

## Properties

### count

> **count**: `number`

Requests in this window.

***

### customerNames

> **customerNames**: `string`[]

Customer names from `customerName`, if you provided it (most requests first).

***

### customers

> **customers**: `number`

Distinct customers (tenants) and users who asked.

***

### examples

> **examples**: `string`[]

Up to five distinct wordings, redacted.

***

### firstAt

> **firstAt**: `string`

***

### key

> **key**: `string`

Stable id for de-duplication across runs ("pf-" + 10 hex chars).

***

### lastAt

> **lastAt**: `string`

***

### reasons

> **reasons**: `object`[]

Reason codes, most common first, and their descriptions.

#### code

> **code**: `string`

#### count

> **count**: `number`

#### label

> **label**: `string`

***

### requesters

> **requesters**: [`Requester`](Requester.md)[]

Who asked: one row per user and surface. Ids stay on your server: the built-in ticket and
chat sinks never send them. Used to tell these users when it ships (`shipFollowUp`) and by
per-customer sinks (HubSpot) to find the account.

***

### summary

> **summary**: `string` \| `null`

One or two sentences on what customers want, if a grouper wrote one.

***

### surfaces

> **surfaces**: `string`[]

***

### title

> **title**: `string`

Short, imperative ticket title.

***

### users

> **users**: `number`

***

### window

> **window**: `object`

The window this run looked at.

#### since

> **since**: `string`

#### until

> **until**: `string`
