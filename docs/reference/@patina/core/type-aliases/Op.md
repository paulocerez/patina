[Patina API reference](../../../README.md) / [@patina/core](../README.md) / Op

# Type Alias: Op

> **Op** = \{ `node`: [`NodeId`](NodeId.md); `op`: `"set"`; `path`: [`Path`](Path.md); `value`: [`Value`](Value.md); \} \| \{ `key`: `string`; `node`: [`NodeId`](NodeId.md); `op`: `"move"`; `prop`: `string`; `to`: [`Anchor`](Anchor.md); \} \| \{ `key`: `string`; `node`: [`NodeId`](NodeId.md); `op`: `"insert"`; `preset`: `string`; `prop`: `string`; `props?`: `Record`\<`string`, [`Value`](Value.md)\>; `to`: [`Anchor`](Anchor.md); \} \| \{ `key`: `string`; `node`: [`NodeId`](NodeId.md); `op`: `"remove"`; `prop`: `string`; \}

## Union Members

### Type Literal

\{ `node`: [`NodeId`](NodeId.md); `op`: `"set"`; `path`: [`Path`](Path.md); `value`: [`Value`](Value.md); \}

***

### Type Literal

\{ `key`: `string`; `node`: [`NodeId`](NodeId.md); `op`: `"move"`; `prop`: `string`; `to`: [`Anchor`](Anchor.md); \}

***

### Type Literal

\{ `key`: `string`; `node`: [`NodeId`](NodeId.md); `op`: `"insert"`; `preset`: `string`; `prop`: `string`; `props?`: `Record`\<`string`, [`Value`](Value.md)\>; `to`: [`Anchor`](Anchor.md); \}

#### key

> **key**: `string`

#### node

> **node**: [`NodeId`](NodeId.md)

#### op

> **op**: `"insert"`

#### preset

> **preset**: `string`

#### prop

> **prop**: `string`

#### props?

> `optional` **props?**: `Record`\<`string`, [`Value`](Value.md)\>

Settings for the new node, validated against its component's prop types.

#### to

> **to**: [`Anchor`](Anchor.md)

***

### Type Literal

\{ `key`: `string`; `node`: [`NodeId`](NodeId.md); `op`: `"remove"`; `prop`: `string`; \}
