[Patina API reference](../../../README.md) / [@patina/core](../README.md) / CollectionDef

# Interface: CollectionDef

The closed type DSL used to declare what may be customized.

There is deliberately no URL, HTML, CSS, script or open-object type: a manifest built
from these types cannot open those doors even by mistake.

## Extends

- [`TypeMeta`](TypeMeta.md)

## Properties

### description?

> `optional` **description?**: `string`

Written for the model: what this prop does.

#### Inherited from

[`TypeMeta`](TypeMeta.md).[`description`](TypeMeta.md#description)

***

### hide

> **hide**: `boolean`

***

### item

> **item**: `Record`\<`string`, [`ScalarTypeDef`](../type-aliases/ScalarTypeDef.md)\>

Extra per-item fields the user may set.

***

### keys

> **keys**: `string`[]

Every key that may appear. Fixed by the host.

***

### kind

> **kind**: `"collection"`

***

### label?

> `optional` **label?**: `string`

Short human name, used in previews and error messages ("Rows per page").

#### Inherited from

[`TypeMeta`](TypeMeta.md).[`label`](TypeMeta.md#label)

***

### labels?

> `optional` **labels?**: `Record`\<`string`, `string`\>

Human names for keys ("revenue" → "Revenue"). Trusted host copy.

***

### reorder

> **reorder**: `boolean`

***

### source?

> `optional` **source?**: `string`

Set by `keysFrom`: the catalog source whose fields are the keys.
