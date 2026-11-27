[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / withBackup

# Function: withBackup()

> **withBackup**(`primary`, `backup`): [`ModelAdapter`](../interfaces/ModelAdapter.md)

Combines two models: `primary` answers first; `backup` takes over for the repair round-trip
(when the primary's answer didn't validate) and when the primary errors or declines.
Typical: a fast, cheap model first and a stronger one as backup.

## Parameters

### primary

[`ModelAdapter`](../interfaces/ModelAdapter.md)

### backup

[`ModelAdapter`](../interfaces/ModelAdapter.md)

## Returns

[`ModelAdapter`](../interfaces/ModelAdapter.md)
