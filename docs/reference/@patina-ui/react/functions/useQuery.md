[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / useQuery

# Function: useQuery()

> **useQuery**(`query`): [`QueryState`](../type-aliases/QueryState.md)

Data for a block. Fetches the source through `fetchSource` (deduplicated and cached for
a few seconds) and evaluates the query in the browser. Use inside components rendered by
<Surface>.

## Parameters

### query

[`Query`](../../core/interfaces/Query.md) \| `undefined`

## Returns

[`QueryState`](../type-aliases/QueryState.md)
