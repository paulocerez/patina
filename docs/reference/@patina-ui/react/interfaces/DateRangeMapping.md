[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / DateRangeMapping

# Interface: DateRangeMapping

## Properties

### format?

> `optional` **format?**: `"date"` \| `"iso"`

"iso" (default): full timestamps; "date": YYYY-MM-DD.

***

### from

> **from**: `string`

Query param names for the start and end the endpoint expects.

***

### param?

> `optional` **param?**: `string`

The catalog param holding a relative range ("thisWeek", "last30days"). Default "range".

***

### to

> **to**: `string`

***

### toExclusive?

> `optional` **toExclusive?**: `boolean`

Whether `to` is the last included moment/day (default) or the first excluded one.

***

### weekStartsOn?

> `optional` **weekStartsOn?**: `0` \| `1`

1 (default): weeks start on Monday.
