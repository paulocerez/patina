[Patina API reference](../../README.md) / @patina-ui/server

# @patina-ui/server

Request handler and storage adapters.

## Classes

- [ConflictError](classes/ConflictError.md)
- [ModelRefusal](classes/ModelRefusal.md)

## Interfaces

- [AvailabilityRule](interfaces/AvailabilityRule.md)
- [HistoryKey](interfaces/HistoryKey.md)
- [InsightsReport](interfaces/InsightsReport.md)
- [ModelAdapter](interfaces/ModelAdapter.md)
- [PatinaContext](interfaces/PatinaContext.md)
- [PatinaHandlerOptions](interfaces/PatinaHandlerOptions.md)
- [Proposal](interfaces/Proposal.md)
- [ReasonCount](interfaces/ReasonCount.md)
- [RequestEvent](interfaces/RequestEvent.md)
- [RequestFilter](interfaces/RequestFilter.md)
- [StorageAdapter](interfaces/StorageAdapter.md)
- [UnmetRequest](interfaces/UnmetRequest.md)
- [UsageKey](interfaces/UsageKey.md)

## Type Aliases

- [Entry](type-aliases/Entry.md)
- [NewEntry](type-aliases/NewEntry.md)
- [QueryFn](type-aliases/QueryFn.md)
- [RequestOutcome](type-aliases/RequestOutcome.md)

## Variables

- [POSTGRES\_SCHEMA](variables/POSTGRES_SCHEMA.md)
- [REASON\_LABELS](variables/REASON_LABELS.md)

## Functions

- [createPatinaHandler](functions/createPatinaHandler.md)
- [getInsights](functions/getInsights.md)
- [memoryStorage](functions/memoryStorage.md)
- [migratePostgres](functions/migratePostgres.md)
- [normalizePrompt](functions/normalizePrompt.md)
- [parseSince](functions/parseSince.md)
- [postgresStorage](functions/postgresStorage.md)
- [renderInsightsMarkdown](functions/renderInsightsMarkdown.md)
- [summarizeRequests](functions/summarizeRequests.md)
- [withBackup](functions/withBackup.md)

## References

### ErrorBody

Re-exports [ErrorBody](../core/interfaces/ErrorBody.md)

***

### ProposeResponse

Re-exports [ProposeResponse](../core/type-aliases/ProposeResponse.md)

***

### SurfaceState

Re-exports [SurfaceState](../core/interfaces/SurfaceState.md)
