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

### privacy?

> `optional` **privacy?**: `"display"` \| `"never"`

How far the field may be used. Default: everywhere (shown, filtered, grouped, aggregated).
- "display": may be shown as a column in table/list views and listed in capabilities, but
  never used to filter, group, sort or aggregate, and its values never reach the model
  (it sees only the field's name, label and kind). Pick this when users already see the
  value elsewhere in the app (e.g. a call summary on every call row).
- "never": same as `sensitive: true`.
`requires` applies at every level.

***

### requires?

> `optional` **requires?**: `string`

Permission the user needs (checked against `ctx.permissions`) to be offered this field.

***

### sensitive?

> `optional` **sensitive?**: `boolean`

Never offered to the model and never usable in new views. Same as `privacy: "never"`.
Use it only for values users can't already see in your app.

***

### valueLabels?

> `optional` **valueLabels?**: `Record`\<`string`, [`Text`](../type-aliases/Text.md)\>

Human names for enum values.

***

### values?

> `optional` **values?**: `string`[]

For enums.
