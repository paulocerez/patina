[Patina API reference](../../../README.md) / [@patina-ui/cli](../README.md) / upsertPrComment

# Function: upsertPrComment()

> **upsertPrComment**(`opts`): `Promise`\<`"created"` \| `"updated"` \| `"skipped"`\>

Creates or updates one sticky PR comment, identified by a hidden marker.

## Parameters

### opts

#### apiUrl?

`string`

#### body

`string`

#### createIfMissing

`boolean`

Only create a new comment if this is true; an existing one is always updated.

#### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### marker

`string`

#### pr

`number`

#### repo

`string`

#### token

`string`

## Returns

`Promise`\<`"created"` \| `"updated"` \| `"skipped"`\>
