[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / useCollection

# Function: useCollection()

> **useCollection**\<`K`\>(`surfaceId`, `nodeId`, `prop`, `fallback`, `options?`): (`Record`\<`string`, `unknown`\> & `object`)[]

The ordered, visible items of a collection prop (e.g. table columns or cards), each
`{ key, ...fields }`. Same fallback rules as `useSlot`. Optional columns the base spec hides
go in `options.hidden`: `useCollection("calls", "table", "columns", ["date", "status", "owner"], { hidden: ["owner"] })`.

## Type Parameters

### K

`K` *extends* `string`

## Parameters

### surfaceId

`string`

### nodeId

`string`

### prop

`string`

### fallback

readonly `K`[]

### options?

[`HookOptions`](../interfaces/HookOptions.md)\<`K`\>

## Returns

(`Record`\<`string`, `unknown`\> & `object`)[]
