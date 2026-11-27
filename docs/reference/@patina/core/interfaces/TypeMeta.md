[Patina API reference](../../../README.md) / [@patina/core](../README.md) / TypeMeta

# Interface: TypeMeta

The closed type DSL used to declare what may be customized.

There is deliberately no URL, HTML, CSS, script or open-object type: a manifest built
from these types cannot open those doors even by mistake.

## Extended by

- [`CollectionDef`](CollectionDef.md)
- [`SlotDef`](SlotDef.md)

## Properties

### description?

> `optional` **description?**: `string`

Written for the model: what this prop does.

***

### label?

> `optional` **label?**: `string`

Short human name, used in previews and error messages ("Rows per page").
