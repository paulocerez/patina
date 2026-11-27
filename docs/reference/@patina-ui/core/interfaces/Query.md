[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / Query

# Interface: Query

## Properties

### fields?

> `optional` **fields?**: `string`[]

rows: the fields to show, in order.

***

### groupBy?

> `optional` **groupBy?**: `object`

series: group by a field (dates need a bucket).

#### bucket?

> `optional` **bucket?**: [`Bucket`](../type-aliases/Bucket.md)

#### field

> **field**: `string`

***

### limit?

> `optional` **limit?**: `number`

***

### metric?

> `optional` **metric?**: `object`

series / single: what to compute.

#### field?

> `optional` **field?**: `string`

#### op

> **op**: [`AggOp`](../type-aliases/AggOp.md)

***

### sort?

> `optional` **sort?**: `object`

rows: sort and limit.

#### dir

> **dir**: `"asc"` \| `"desc"`

#### field

> **field**: `string`

***

### source

> **source**: `string`

***

### where?

> `optional` **where?**: `object`[]

Simple equality filters on enum and bool fields.

#### field

> **field**: `string`

#### value

> **value**: `string` \| `boolean`
