[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / dataBlocks

# Function: dataBlocks()

> **dataBlocks**(`catalog`): `object`

Manifest entries for the data blocks: components (with `t.query` props bound to the
catalog) and insertable presets with sensible default queries.

```ts
const blocks = dataBlocks(catalog);
defineSurface({
  catalog,
  components: { ...myComponents, ...blocks.components },
  presets: { ...blocks.presets },
  // and allow them in a slot:
  // main: t.slot({ accepts: [..., ...blocks.componentNames], insert: blocks.presetIds })
})
```

## Parameters

### catalog

[`Catalog`](../interfaces/Catalog.md)

## Returns

`object`

### componentNames

> **componentNames**: `string`[]

### components

> **components**: `Record`\<`string`, [`ComponentDef`](../interfaces/ComponentDef.md)\>

### presetIds

> **presetIds**: `string`[]

### presets

> **presets**: `Record`\<`string`, [`PresetDef`](../interfaces/PresetDef.md)\>
