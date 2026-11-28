[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / createFetchSource

# Function: createFetchSource()

> **createFetchSource**(`options?`): [`FetchSource`](../type-aliases/FetchSource.md)

A `fetchSource` for common APIs, configured instead of written: another origin, tenant
params, path placeholders, paging, rows inside an envelope and relative date ranges.

  createFetchSource({
    baseUrl: import.meta.env.VITE_API_URL,
    credentials: "include",
    params: { accountId },
    sources: {
      orders: { rows: "items", paging: { style: "offset", size: 200, total: "total" },
                dateRange: { from: "fromDate", to: "toDate" } },
    },
  })

With paging, every page is fetched, so the source can be `complete: true`.

## Parameters

### options?

[`FetchSourceOptions`](../interfaces/FetchSourceOptions.md) = `{}`

## Returns

[`FetchSource`](../type-aliases/FetchSource.md)
