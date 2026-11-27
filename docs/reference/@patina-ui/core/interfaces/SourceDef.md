[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / SourceDef

# Interface: SourceDef

## Properties

### complete?

> `optional` **complete?**: `boolean`

True if the endpoint returns *all* matching rows (not one page). Required before Patina
offers aggregations (count, sum, …) over it, so totals are never silently wrong.

***

### description?

> `optional` **description?**: [`Text`](../type-aliases/Text.md)

***

### endpoint

> **endpoint**: `object`

Only GET. The path is relative to the app's origin; the model never sees it.

#### method

> **method**: `"GET"`

#### path

> **path**: `string`

***

### fields

> **fields**: `Record`\<`string`, [`FieldDef`](FieldDef.md)\>

***

### label

> **label**: [`Text`](../type-aliases/Text.md)

***

### params?

> `optional` **params?**: `Record`\<`string`, [`ParamBinding`](ParamBinding.md)\>

***

### requires?

> `optional` **requires?**: `string`

Permission the user needs to be offered this source at all.

***

### rowKey?

> `optional` **rowKey?**: `string`
