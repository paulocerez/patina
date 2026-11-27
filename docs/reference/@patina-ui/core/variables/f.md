[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / f

# Variable: f

> `const` **f**: `object`

## Type Declaration

### bool

> **bool**: (`o`) => [`FieldDef`](../interfaces/FieldDef.md)

#### Parameters

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### contains

> **contains**: (`from`, `any`, `o`) => [`FieldDef`](../interfaces/FieldDef.md)

True when the text field `from` contains any of `any` (case-insensitive).

#### Parameters

##### from

`string`

##### any

`string`[]

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### currency

> **currency**: (`currency`, `o`) => [`FieldDef`](../interfaces/FieldDef.md)

#### Parameters

##### currency

`string`

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### date

> **date**: (`o`) => [`FieldDef`](../interfaces/FieldDef.md)

#### Parameters

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### enum

> **enum**: (`values`, `o`) => [`FieldDef`](../interfaces/FieldDef.md)

#### Parameters

##### values

`string`[]

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### hour

> **hour**: (`from`, `o`) => [`FieldDef`](../interfaces/FieldDef.md)

Hour of the date field `from`, "00" … "23", in `timeZone` (default: the browser's).

#### Parameters

##### from

`string`

##### o?

`FieldOpts` & `object` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### number

> **number**: (`o`) => [`FieldDef`](../interfaces/FieldDef.md)

#### Parameters

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### ranges

> **ranges**: (`from`, `ranges`, `o`) => [`FieldDef`](../interfaces/FieldDef.md)

Groups the number field `from` into named ranges: `[{ value: "short", below: 30 }, { value: "long" }]`.

#### Parameters

##### from

`string`

##### ranges

`object`[]

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### string

> **string**: (`o`) => [`FieldDef`](../interfaces/FieldDef.md)

#### Parameters

##### o?

`FieldOpts` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)

### weekday

> **weekday**: (`from`, `o`) => [`FieldDef`](../interfaces/FieldDef.md)

Day of the week of the date field `from`, in `timeZone` (default: the browser's).

#### Parameters

##### from

`string`

##### o?

`FieldOpts` & `object` = `{}`

#### Returns

[`FieldDef`](../interfaces/FieldDef.md)
