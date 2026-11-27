[Patina API reference](../../../README.md) / [@patina/server](../README.md) / Proposal

# Interface: Proposal

A validated patch the user is previewing. Committed by ID, never re-sent by the client.

## Properties

### baseSeq

> **baseSeq**: `number`

History head when the proposal was made.

***

### expiresAt

> **expiresAt**: `string`

***

### id

> **id**: `string`

***

### key

> **key**: [`HistoryKey`](HistoryKey.md)

***

### model

> **model**: `string`

***

### ops

> **ops**: [`Op`](../../core/type-aliases/Op.md)[]

***

### prompt

> **prompt**: `string`

***

### summary

> **summary**: `string`
