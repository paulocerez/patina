[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / FieldDef

# Interface: FieldDef

## Properties

### currency?

> `optional` **currency?**: `string`

ISO 4217 code, for currency fields.

***

### derive?

> `optional` **derive?**: [`Derive`](../type-aliases/Derive.md)

Computed from another field of the row instead of read from it (see `Derive`).

***

### description?

> `optional` **description?**: [`Text`](../type-aliases/Text.md)

***

### kind

> **kind**: [`FieldKind`](../type-aliases/FieldKind.md)

***

### label?

> `optional` **label?**: [`Text`](../type-aliases/Text.md)

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

> `optional` **valueLabels?**: `Record`\<`string`, [`Text`](../type-aliases/Text.md)\>

Human names for enum values.

***

### values?

> `optional` **values?**: `string`[]

For enums.
