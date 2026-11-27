[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / SurfaceDefinition

# Interface: SurfaceDefinition\<Ctx\>

## Type Parameters

### Ctx

`Ctx` = `unknown`

## Properties

### base

> **base**: [`SurfaceSpec`](SurfaceSpec.md)

***

### catalog?

> `optional` **catalog?**: [`Catalog`](Catalog.md)

Data sources users may compose into new views (see `defineCatalog`).

***

### components

> **components**: `Record`\<`string`, [`ComponentDef`](ComponentDef.md)\>

***

### description?

> `optional` **description?**: [`Text`](../type-aliases/Text.md)

Written for the model: what this surface is.

***

### id

> **id**: `string`

***

### labels?

> `optional` **labels?**: `Record`\<`string`, [`Text`](../type-aliases/Text.md)\>

Human names for nodes ("appointments" → "Appointments table").

***

### migrations?

> `optional` **migrations?**: `Record`\<`number`, [`Migration`](../type-aliases/Migration.md)[]\>

Ops authored before `version` N pass through `migrations[N]`.

***

### presets?

> `optional` **presets?**: `Record`\<`string`, [`PresetDef`](PresetDef.md)\>

***

### version

> **version**: `number`

The host's version of the base view. Bump it when you ship a new base spec.

## Methods

### restrict()?

> `optional` **restrict**(`ctx`): [`Restriction`](Restriction.md) \| `Promise`\<[`Restriction`](Restriction.md)\>

Narrows the manifest for one request. Called with the host's request context.

#### Parameters

##### ctx

`Ctx`

#### Returns

[`Restriction`](Restriction.md) \| `Promise`\<[`Restriction`](Restriction.md)\>
