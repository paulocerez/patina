[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / SettingCapability

# Interface: SettingCapability

## Properties

### current?

> `optional` **current?**: [`Value`](../type-aliases/Value.md)

***

### kind

> **kind**: `"object"` \| `"enum"` \| `"int"` \| `"bool"` \| `"label"` \| `"relativeDateRange"` \| `"sort"` \| `"query"` \| `"collection"` \| `"slot"`

***

### label

> **label**: `string`

e.g. "Default date range".

***

### max?

> `optional` **max?**: `number`

***

### min?

> `optional` **min?**: `number`

For numbers.

***

### node

> **node**: `string`

***

### nodeLabel

> **nodeLabel**: `string`

The part of the page it belongs to, e.g. "Dashboard".

***

### prop

> **prop**: `string`

***

### values?

> `optional` **values?**: `object`[]

The values it can take, for enums, on/off, date ranges and sorts.

#### label

> **label**: `string`

#### value

> **value**: [`Value`](../type-aliases/Value.md)
