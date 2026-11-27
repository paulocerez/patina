[Patina API reference](../../../../README.md) / [@patina/server/express](../README.md) / toExpress

# Function: toExpress()

> **toExpress**(`handler`): (`req`, `res`, `next?`) => `Promise`\<`void`\>

Adapts a Fetch-style handler to Express (or plain Node `http`) middleware.

  app.use("/api/patina", toExpress(patina));

Works with or without `express.json()` in front of it.

## Parameters

### handler

`FetchHandler`

## Returns

(`req`, `res`, `next?`) => `Promise`\<`void`\>
