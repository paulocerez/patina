[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / relevantOptions

# Function: relevantOptions()

> **relevantOptions**(`m`, `spec`, `prompt`, `refusal`, `maxLines?`): `string`

The part of the manifest a refusal is about, as short text for the retry: allowed values with
their labels in the user's language, collection keys, insertable presets and data fields.
Falls back to every setting when the prompt and refusal name nothing.

## Parameters

### m

[`Manifest`](../interfaces/Manifest.md)\<`unknown`\>

### spec

[`SurfaceSpec`](../interfaces/SurfaceSpec.md)

### prompt

`string`

### refusal

[`RefusalInfo`](../interfaces/RefusalInfo.md)

### maxLines?

`number` = `40`

## Returns

`string`
