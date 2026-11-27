[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / Manifest

# Interface: Manifest\<Ctx\>

## Extends

- `Required`\<`Omit`\<[`SurfaceDefinition`](SurfaceDefinition.md)\<`Ctx`\>, `"restrict"` \| `"catalog"`\>\>

## Type Parameters

### Ctx

`Ctx` = `unknown`

## Properties

### base

> **base**: [`SurfaceSpec`](SurfaceSpec.md)

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`base`](SurfaceDefinition.md#base)

***

### catalog?

> `optional` **catalog?**: [`Catalog`](Catalog.md)

***

### components

> **components**: `Record`\<`string`, [`ComponentDef`](ComponentDef.md)\>

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`components`](SurfaceDefinition.md#components)

***

### description

> **description**: `string`

Written for the model: what this surface is.

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`description`](SurfaceDefinition.md#description)

***

### id

> **id**: `string`

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`id`](SurfaceDefinition.md#id)

***

### labels

> **labels**: `Record`\<[`NodeId`](../type-aliases/NodeId.md), `string`\>

Human names for nodes ("appointments" → "Appointments table").

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`labels`](SurfaceDefinition.md#labels)

***

### migrations

> **migrations**: `Record`\<`number`, [`Migration`](../type-aliases/Migration.md)[]\>

Ops authored before `version` N pass through `migrations[N]`.

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`migrations`](SurfaceDefinition.md#migrations)

***

### presets

> **presets**: `Record`\<`string`, [`PresetDef`](PresetDef.md)\>

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`presets`](SurfaceDefinition.md#presets)

***

### restriction?

> `optional` **restriction?**: [`Restriction`](Restriction.md)

Set on manifests returned by `restrictManifest`.

***

### version

> **version**: `number`

The host's version of the base view. Bump it when you ship a new base spec.

#### Inherited from

[`SurfaceDefinition`](SurfaceDefinition.md).[`version`](SurfaceDefinition.md#version)

## Methods

### restrict()?

> `optional` **restrict**(`ctx`): [`Restriction`](Restriction.md)

#### Parameters

##### ctx

`Ctx`

#### Returns

[`Restriction`](Restriction.md)
