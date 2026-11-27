[Patina API reference](../../../README.md) / [@patina/core](../README.md) / FieldDef

# Interface: FieldDef

## Properties

### currency?

> `optional` **currency?**: `string`

ISO 4217 code, for currency fields.

***

### description?

> `optional` **description?**: `string`

***

### kind

> **kind**: [`FieldKind`](../type-aliases/FieldKind.md)

***

### label?

> `optional` **label?**: `string`

***

### requires?

> `optional` **requires?**: `string`

Permission the user needs (checked against `ctx.permissions`) to be offered this field.

***

### sensitive?

> `optional` **sensitive?**: `boolean`

Never offered to the model and never usable in new views.

***

### valueLabels?

> `optional` **valueLabels?**: `Record`\<`string`, `string`\>

Human names for enum values.

***

### values?

> `optional` **values?**: `string`[]

For enums.
