[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / redoTarget

# Function: redoTarget()

> **redoTarget**(`entries`): [`HistoryEntry`](../type-aliases/HistoryEntry.md) \| `null`

The undo that `redo` would take back: the latest revert still in effect, as long as no change
was made after it (a new change ends the redo chain, like in any editor). Redo appends a
revert of this revert.

## Parameters

### entries

readonly [`HistoryEntry`](../type-aliases/HistoryEntry.md)[]

## Returns

[`HistoryEntry`](../type-aliases/HistoryEntry.md) \| `null`
