[Patina API reference](../../../README.md) / [@patina/core](../README.md) / migrations

# Variable: migrations

> `const` **migrations**: `object`

Helpers for the common base-view changes.

## Type Declaration

### dropNode

> **dropNode**: (`id`) => [`Migration`](../type-aliases/Migration.md)

Drops every op that targets a node, on purpose and without a skip report.

#### Parameters

##### id

`string`

#### Returns

[`Migration`](../type-aliases/Migration.md)

### renameKey

> **renameKey**: (`node`, `prop`, `from`, `to`) => [`Migration`](../type-aliases/Migration.md)

A key inside a collection or slot was renamed (e.g. a column "vet" → "doctor").

#### Parameters

##### node

`string`

##### prop

`string`

##### from

`string`

##### to

`string`

#### Returns

[`Migration`](../type-aliases/Migration.md)

### renameNode

> **renameNode**: (`from`, `to`) => [`Migration`](../type-aliases/Migration.md)

A node was renamed. Updates ops on the node and references to it in slots.

#### Parameters

##### from

`string`

##### to

`string`

#### Returns

[`Migration`](../type-aliases/Migration.md)

### renameProp

> **renameProp**: (`component`, `from`, `to`) => [`Migration`](../type-aliases/Migration.md)

A prop of a component was renamed.

#### Parameters

##### component

`string`

##### from

`string`

##### to

`string`

#### Returns

[`Migration`](../type-aliases/Migration.md)
