---
"@patina-ui/cli": minor
"@patina-ui/react": minor
"@patina-ui/core": minor
---

Less hand work per app: the scan understands layered backends, and fetching is configured instead of written.

- **Scan:** follows handlers passed by reference (`router.get("/", controller.list)`) into their bodies, the helpers they hand `req` to, and the return types of the services they call, including class methods and wrapped lists (`Promise<{ items: T[]; total }>`). It prefers row types near the route over same-named ones elsewhere, resolves exported string-literal unions to enums, keeps tenant path placeholders (`/accounts/:accountId/…`), and notes paging, date-range params and the rows' key. More personal fields are flagged (caller numbers, person names, notes, comments, transcripts).
- **`patina/fetch.ts`:** the scan drafts a `fetchSource` from what it found, and the catalog draft suggests derived fields (weekday, hour, ranges).
- **`createFetchSource`** (react): another origin, tenant params and path placeholders, rows inside an envelope, offset/page/cursor paging (pages fetched in order, capped by `maxPages`), and relative date ranges mapped to the endpoint's own params.
- **`rangeBounds`, `asRelativeRange`** (core): a relative range as two dates.
