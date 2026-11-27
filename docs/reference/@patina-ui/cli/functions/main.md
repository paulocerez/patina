[Patina API reference](../../../README.md) / [@patina-ui/cli](../README.md) / main

# Function: main()

> **main**(`argv?`, `deps?`): `Promise`\<`number`\>

## Parameters

### argv?

`string`[] = `...`

### deps?

For tests: use this storage instead of connecting to Postgres.

#### grouper?

[`FollowUpGrouper`](../../server/followups/type-aliases/FollowUpGrouper.md)

#### sinks?

[`FollowUpSink`](../../server/followups/interfaces/FollowUpSink.md)[]

#### storage?

[`StorageAdapter`](../../server/interfaces/StorageAdapter.md)

## Returns

`Promise`\<`number`\>
