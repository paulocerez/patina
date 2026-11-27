[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / ParamBinding

# Interface: ParamBinding

## Properties

### choiceLabels?

> `optional` **choiceLabels?**: `Record`\<`string`, [`Text`](../type-aliases/Text.md)\>

Human names for `choices`.

***

### choices?

> `optional` **choices?**: `string`[]

Values a single view may pick instead (its query's `params`), e.g. a chart of "this week"
on a page that defaults to the last 30 days. Your `fetchSource` receives the value.

***

### from?

> `optional` **from?**: `string`

Take the value from a prop of the current spec: "nodeId.prop" (e.g. "filters.dateRange").

***

### label?

> `optional` **label?**: [`Text`](../type-aliases/Text.md)

What the param is, e.g. "Date range".

***

### value?

> `optional` **value?**: `string` \| `number` \| `boolean`

Or a fixed value.
