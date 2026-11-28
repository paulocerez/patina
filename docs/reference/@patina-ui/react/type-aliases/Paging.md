[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / Paging

# Type Alias: Paging

> **Paging** = \{ `limit?`: `string`; `offset?`: `string`; `size`: `number`; `style`: `"offset"`; `total?`: `string`; \} \| \{ `first?`: `0` \| `1`; `page?`: `string`; `pageSize?`: `string`; `size`: `number`; `style`: `"page"`; `total?`: `string`; \} \| \{ `cursor?`: `string`; `limit?`: `string`; `next`: `string`; `size?`: `number`; `style`: `"cursor"`; \}

How an endpoint pages through its rows. Pages are fetched one after another.

## Union Members

### Type Literal

\{ `limit?`: `string`; `offset?`: `string`; `size`: `number`; `style`: `"offset"`; `total?`: `string`; \}

`?limit=200&offset=400`; stops at a short page or at `total`.

***

### Type Literal

\{ `first?`: `0` \| `1`; `page?`: `string`; `pageSize?`: `string`; `size`: `number`; `style`: `"page"`; `total?`: `string`; \}

`?page=3&pageSize=50`; `first` is the first page's number (default 1).

***

### Type Literal

\{ `cursor?`: `string`; `limit?`: `string`; `next`: `string`; `size?`: `number`; `style`: `"cursor"`; \}

`?cursor=…`; the next cursor is read from `next` in the response ("nextCursor", "meta.next").
