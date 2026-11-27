[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / memoryProposals

# Function: memoryProposals()

> **memoryProposals**(`now?`): `Pick`\<[`StorageAdapter`](../interfaces/StorageAdapter.md), `"saveProposal"` \| `"takeProposal"`\>

Previews held in this process's memory (expired ones are dropped as new ones arrive).
For `postgresStorage({ previews: "memory" })` or your own adapter.

## Parameters

### now?

() => `number`

## Returns

`Pick`\<[`StorageAdapter`](../interfaces/StorageAdapter.md), `"saveProposal"` \| `"takeProposal"`\>
