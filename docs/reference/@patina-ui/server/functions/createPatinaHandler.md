[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / createPatinaHandler

# Function: createPatinaHandler()

> **createPatinaHandler**\<`Ctx`\>(`options`): (`request`) => `Promise`\<`Response`\>

Creates the Patina request handler: `(Request) => Promise<Response>`.
Mount it under `basePath` in any framework that speaks the Fetch API, or wrap it with
`toExpress` from "@patina-ui/server/express".

## Type Parameters

### Ctx

`Ctx` *extends* [`PatinaContext`](../interfaces/PatinaContext.md)

## Parameters

### options

[`PatinaHandlerOptions`](../interfaces/PatinaHandlerOptions.md)\<`Ctx`\>

## Returns

(`request`) => `Promise`\<`Response`\>
