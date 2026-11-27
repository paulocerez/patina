[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / t

# Variable: t

> `const` **t**: `object`

## Type Declaration

### bool

> **bool**: (`meta`) => `object`

#### Parameters

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### kind

> `readonly` **kind**: `"bool"` = `"bool"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").

### collection

> **collection**: (`opts`) => [`CollectionDef`](../interfaces/CollectionDef.md)

A keyed list, e.g. table columns. Pass `keys`, or `keysFrom` to offer every non-sensitive
field of a catalog source (fields missing from the base spec appear hidden by default).

#### Parameters

##### opts

`Omit`\<[`CollectionDef`](../interfaces/CollectionDef.md), `"kind"` \| `"source"` \| `"keys"` \| `"item"` \| `"reorder"` \| `"hide"`\> & `Partial`\<`Pick`\<[`CollectionDef`](../interfaces/CollectionDef.md), `"keys"` \| `"item"` \| `"reorder"` \| `"hide"`\>\> & `object`

#### Returns

[`CollectionDef`](../interfaces/CollectionDef.md)

### enum

> **enum**: (`values`, `meta`) => `object`

#### Parameters

##### values

`string`[]

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) & `object` = `{}`

#### Returns

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### kind

> `readonly` **kind**: `"enum"` = `"enum"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").

##### labels?

> `readonly` `optional` **labels?**: `Record`\<`string`, [`Text`](../type-aliases/Text.md)\>

##### values

> **values**: `string`[]

### int

> **int**: (`range`, `meta`) => `object`

#### Parameters

##### range

###### max

`number`

###### min

`number`

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### kind

> `readonly` **kind**: `"int"` = `"int"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").

##### max

> `readonly` **max**: `number`

##### min

> `readonly` **min**: `number`

### label

> **label**: (`opts`, `meta`) => `object`

#### Parameters

##### opts

###### maxLen

`number`

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### kind

> `readonly` **kind**: `"label"` = `"label"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").

##### maxLen

> `readonly` **maxLen**: `number`

### object

> **object**: (`fields`, `meta`) => `object`

#### Parameters

##### fields

`Record`\<`string`, [`ScalarTypeDef`](../type-aliases/ScalarTypeDef.md)\>

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### fields

> **fields**: `Record`\<`string`, [`ScalarTypeDef`](../type-aliases/ScalarTypeDef.md)\>

##### kind

> `readonly` **kind**: `"object"` = `"object"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").

### query

> **query**: (`catalog`, `opts`, `meta`) => [`QueryDef`](../interfaces/QueryDef.md)

A view over a catalog source, for data blocks. `shape` is "rows" (pick fields),
"series" (group + aggregate) or "single" (one number).

#### Parameters

##### catalog

[`Catalog`](../interfaces/Catalog.md)

##### opts

###### aggregations?

[`AggOp`](../type-aliases/AggOp.md)[]

###### shape

[`QueryShape`](../type-aliases/QueryShape.md)

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

[`QueryDef`](../interfaces/QueryDef.md)

### relativeDateRange

> **relativeDateRange**: (`allowed`, `meta`) => `object`

#### Parameters

##### allowed

(`"today"` \| `"yesterday"` \| `"thisWeek"` \| `"lastWeek"` \| `"thisMonth"` \| `"lastMonth"` \| `"last7Days"` \| `"last30Days"` \| `"last90Days"` \| `"thisYear"`)[]

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

##### allowed

> **allowed**: (`"today"` \| `"yesterday"` \| `"thisWeek"` \| `"lastWeek"` \| `"thisMonth"` \| `"lastMonth"` \| `"last7Days"` \| `"last30Days"` \| `"last90Days"` \| `"thisYear"`)[]

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### kind

> `readonly` **kind**: `"relativeDateRange"` = `"relativeDateRange"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").

### slot

> **slot**: (`opts`) => [`SlotDef`](../interfaces/SlotDef.md)

#### Parameters

##### opts

`Omit`\<[`SlotDef`](../interfaces/SlotDef.md), `"kind"` \| `"insert"` \| `"reorder"` \| `"hide"`\> & `Partial`\<`Pick`\<[`SlotDef`](../interfaces/SlotDef.md), `"insert"` \| `"reorder"` \| `"hide"`\>\>

#### Returns

[`SlotDef`](../interfaces/SlotDef.md)

### sort

> **sort**: (`keys`, `meta`) => `object`

#### Parameters

##### keys

`string`[]

##### meta?

[`TypeMeta`](../interfaces/TypeMeta.md) = `{}`

#### Returns

##### description?

> `readonly` `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this prop does.

##### keys

> **keys**: `string`[]

##### kind

> `readonly` **kind**: `"sort"` = `"sort"`

##### label?

> `readonly` `optional` **label?**: [`Text`](../type-aliases/Text.md)

Short human name, used in previews and error messages ("Rows per page").
