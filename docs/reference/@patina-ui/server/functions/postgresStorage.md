[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / postgresStorage

# Function: postgresStorage()

> **postgresStorage**(`__namedParameters`): [`StorageAdapter`](../interfaces/StorageAdapter.md) & `Required`\<`Pick`\<[`StorageAdapter`](../interfaces/StorageAdapter.md), `"incrementUsage"` \| `"logRequest"` \| `"listRequests"`\>\> & `object`

Postgres storage. History is append-only; `append` uses the unique
`(tenant_id, layer, subject_id, surface_id, seq)` constraint for optimistic concurrency.

## Parameters

### \_\_namedParameters

#### query

[`QueryFn`](../type-aliases/QueryFn.md)

## Returns

[`StorageAdapter`](../interfaces/StorageAdapter.md) & `Required`\<`Pick`\<[`StorageAdapter`](../interfaces/StorageAdapter.md), `"incrementUsage"` \| `"logRequest"` \| `"listRequests"`\>\> & `object`
