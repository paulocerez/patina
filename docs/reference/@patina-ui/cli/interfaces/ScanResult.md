[Patina API reference](../../../README.md) / [@patina-ui/cli](../README.md) / ScanResult

# Interface: ScanResult

## Properties

### design

> **design**: `object`

#### classes

> **classes**: `string`[]

Utility classes defined in the app's CSS that blocks can reuse (card, badge, muted…).

#### components

> **components**: [`ScannedComponent`](ScannedComponent.md)[]

#### cssVariables

> **cssVariables**: `Record`\<`string`, `string`\>

CSS custom properties from :root and `@theme` (name → value).

***

### sources

> **sources**: `Record`\<`string`, [`ScannedSource`](ScannedSource.md)\>

***

### stack

> **stack**: `object`

#### charts

> **charts**: `string` \| `null`

#### frameworks

> **frameworks**: `string`[]

#### tables

> **tables**: `string` \| `null`

#### tailwind

> **tailwind**: `boolean`

#### ui

> **ui**: [`UiKit`](../type-aliases/UiKit.md)

***

### version

> **version**: `1`
