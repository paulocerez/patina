[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / postgresStorage

# Function: postgresStorage()

## Call Signature

> **postgresStorage**(`options`): `FullPostgresStorage`

Postgres storage. History is append-only; `append` uses the unique
`(tenant_id, layer, subject_id, surface_id, seq)` constraint for optimistic concurrency.

Pass features to use fewer tables, e.g. only saved customizations:

  postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })

### Parameters

#### options

##### query

[`QueryFn`](../type-aliases/QueryFn.md)

### Returns

`FullPostgresStorage`

## Call Signature

> **postgresStorage**(`options`): [`StorageAdapter`](../interfaces/StorageAdapter.md) & `object`

Postgres storage. History is append-only; `append` uses the unique
`(tenant_id, layer, subject_id, surface_id, seq)` constraint for optimistic concurrency.

Pass features to use fewer tables, e.g. only saved customizations:

  postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })

### Parameters

#### options

`object` & [`PostgresFeatures`](../interfaces/PostgresFeatures.md)

### Returns

[`StorageAdapter`](../interfaces/StorageAdapter.md) & `object`
