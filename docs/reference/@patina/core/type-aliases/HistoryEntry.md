[Patina API reference](../../../README.md) / [@patina/core](../README.md) / HistoryEntry

# Type Alias: HistoryEntry

> **HistoryEntry** = \{ `id`: `string`; `kind`: `"patch"`; `patch`: [`Patch`](../interfaces/Patch.md); `seq`: `number`; \} \| \{ `id`: `string`; `kind`: `"revert"`; `seq`: `number`; `targetId`: `string`; \} \| \{ `id`: `string`; `kind`: `"reset"`; `seq`: `number`; \}

The storage-neutral shape of a history entry. Adapters may store more fields.
