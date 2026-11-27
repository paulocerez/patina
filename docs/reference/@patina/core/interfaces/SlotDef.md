[Patina API reference](../../../README.md) / [@patina/core](../README.md) / SlotDef

# Interface: SlotDef

The closed type DSL used to declare what may be customized.

There is deliberately no URL, HTML, CSS, script or open-object type: a manifest built
from these types cannot open those doors even by mistake.

## Extends

- [`TypeMeta`](TypeMeta.md)

## Properties

### accepts

> **accepts**: `string`[]

Components that may live in this slot.

***

### description?

> `optional` **description?**: `string`

Written for the model: what this prop does.

#### Inherited from

[`TypeMeta`](TypeMeta.md).[`description`](TypeMeta.md#description)

***

### hide

> **hide**: `boolean`

***

### insert

> **insert**: `string`[]

Preset IDs the user may insert here.

***

### kind

> **kind**: `"slot"`

***

### label?

> `optional` **label?**: `string`

Short human name, used in previews and error messages ("Rows per page").

#### Inherited from

[`TypeMeta`](TypeMeta.md).[`label`](TypeMeta.md#label)

***

### reorder

> **reorder**: `boolean`
