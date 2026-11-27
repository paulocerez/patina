[Patina API reference](../../../../README.md) / [@patina-ui/server/integrations](../README.md) / combineEvents

# Function: combineEvents()

> **combineEvents**(...`handlers`): [`EventHandler`](../type-aliases/EventHandler.md)

One `onEvent` from several. Each runs even if another fails; failures are rethrown together
as an AggregateError, which the handler passes to `onError`.

## Parameters

### handlers

...([`EventHandler`](../type-aliases/EventHandler.md) \| `null` \| `undefined`)[]

## Returns

[`EventHandler`](../type-aliases/EventHandler.md)
