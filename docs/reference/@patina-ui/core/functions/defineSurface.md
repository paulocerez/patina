[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / defineSurface

# Function: defineSurface()

> **defineSurface**\<`Ctx`\>(`def`): [`Manifest`](../interfaces/Manifest.md)\<`Ctx`\>

Declares a customizable surface. Throws at startup if the base spec does not match
the manifest, so mistakes surface in development rather than in a user's view.

## Type Parameters

### Ctx

`Ctx` = `unknown`

## Parameters

### def

[`SurfaceDefinition`](../interfaces/SurfaceDefinition.md)\<`Ctx`\>

## Returns

[`Manifest`](../interfaces/Manifest.md)\<`Ctx`\>
