[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / rangeBounds

# Function: rangeBounds()

> **rangeBounds**(`range`, `now?`, `options?`): `object`

Start (inclusive) and end (exclusive) of a relative range in local time, as Dates.
"last7Days" is the 7 days before today plus today, like most date filters.

## Parameters

### range

`"today"` \| `"yesterday"` \| `"thisWeek"` \| `"lastWeek"` \| `"thisMonth"` \| `"lastMonth"` \| `"last7Days"` \| `"last30Days"` \| `"last90Days"` \| `"thisYear"`

### now?

`Date` = `...`

### options?

#### weekStartsOn?

`0` \| `1`

## Returns

`object`

### from

> **from**: `Date`

### to

> **to**: `Date`
