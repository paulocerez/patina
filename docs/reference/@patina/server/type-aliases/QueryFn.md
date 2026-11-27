[Patina API reference](../../../README.md) / [@patina/server](../README.md) / QueryFn

# Type Alias: QueryFn

> **QueryFn** = (`sql`, `params?`) => `Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

Any function that runs a parameterized query and returns rows: `pg`'s `pool.query`,
PGlite's `db.query`, or a two-line shim around postgres.js. Patina imports no driver.

## Parameters

### sql

`string`

### params?

`unknown`[]

## Returns

`Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>
