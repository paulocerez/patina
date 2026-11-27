[Patina API reference](../../README.md) / @patina-ui/server

# @patina-ui/server

Request handler and storage adapters.

## Classes

- [ConflictError](classes/ConflictError.md)
- [ModelRefusal](classes/ModelRefusal.md)

## Interfaces

- [AvailabilityRule](interfaces/AvailabilityRule.md)
- [FollowUpLinks](interfaces/FollowUpLinks.md)
- [HistoryKey](interfaces/HistoryKey.md)
- [InsightsReport](interfaces/InsightsReport.md)
- [ModelAdapter](interfaces/ModelAdapter.md)
- [NoticeTarget](interfaces/NoticeTarget.md)
- [PatinaContext](interfaces/PatinaContext.md)
- [PatinaHandlerOptions](interfaces/PatinaHandlerOptions.md)
- [PostgresFeatures](interfaces/PostgresFeatures.md)
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
- [PostgresTable](type-aliases/PostgresTable.md)
- [QueryFn](type-aliases/QueryFn.md)
- [RequestOutcome](type-aliases/RequestOutcome.md)

## Variables

- [POSTGRES\_SCHEMA](variables/POSTGRES_SCHEMA.md)
- [REASON\_LABELS](variables/REASON_LABELS.md)

## Functions

- [createPatinaHandler](functions/createPatinaHandler.md)
- [getInsights](functions/getInsights.md)
- [memoryProposals](functions/memoryProposals.md)
- [memoryStorage](functions/memoryStorage.md)
- [migratePostgres](functions/migratePostgres.md)
- [normalizePrompt](functions/normalizePrompt.md)
- [parseSince](functions/parseSince.md)
- [postgresSchema](functions/postgresSchema.md)
- [postgresStorage](functions/postgresStorage.md)
- [postgresTables](functions/postgresTables.md)
- [renderInsightsMarkdown](functions/renderInsightsMarkdown.md)
- [summarizeRequests](functions/summarizeRequests.md)
- [withBackup](functions/withBackup.md)

## References

### ErrorBody

Re-exports [ErrorBody](../core/interfaces/ErrorBody.md)

***

### Notice

Re-exports [Notice](../core/interfaces/Notice.md)

***

### ProposeResponse

Re-exports [ProposeResponse](../core/type-aliases/ProposeResponse.md)

***

### SurfaceState

Re-exports [SurfaceState](../core/interfaces/SurfaceState.md)
