[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / CapabilitiesRenderProps

# Interface: CapabilitiesRenderProps

## Properties

### capabilities

> **capabilities**: [`Capabilities`](../../core/interfaces/Capabilities.md)

***

### examples

> **examples**: `string`[]

A few example prompts for this surface, e.g. for chips in the prompt box.

***

### lines

> **lines**: `string`[]

One readable line per capability ("Sections (…): reorder, hide").

***

### title

> **title**: `string`

The localized heading ("What you can ask for").

## Methods

### propose()

> **propose**(`prompt`): `Promise`\<`void`\>

Sends a prompt, e.g. when a chip is clicked.

#### Parameters

##### prompt

`string`

#### Returns

`Promise`\<`void`\>
