[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / HistoryRequest

# Interface: HistoryRequest

Body of POST /surfaces/:id/undo, /redo and /reset. All optional.

## Properties

### expectedSeq?

> `optional` **expectedSeq?**: `number`

`SurfaceState.seq` as the client saw it. A different head answers 409.
