[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / Entry

# Type Alias: Entry

> **Entry** = [`HistoryEntry`](../../core/type-aliases/HistoryEntry.md) & `object`

A stored history entry: the core entry plus audit fields.

## Type Declaration

### createdAt

> **createdAt**: `string`

### model?

> `optional` **model?**: `string` \| `null`

For patches: which model produced it, e.g. "anthropic/claude-opus-5-5".

### prompt?

> `optional` **prompt?**: `string` \| `null`

For patches: the user's original prompt (may be cleared by retention).

### summary?

> `optional` **summary?**: `string` \| `null`
