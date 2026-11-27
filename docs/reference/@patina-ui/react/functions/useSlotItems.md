[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / useSlotItems

# Function: useSlotItems()

> **useSlotItems**\<`K`\>(`surfaceId`, `nodeId`, `prop`, `fallback`, `options?`): [`SlotItem`](../type-aliases/SlotItem.md)\<`K`\>[]

Like `useSlot`, plus the blocks users added (data views and your presets), in place:

  useSlotItems("dashboard", "overview", "sections", SECTIONS).map((item) =>
    item.kind === "host"
      ? <Fragment key={item.key}>{blocks[item.key]}</Fragment>
      : <PatinaBlock key={item.key} surfaceId="dashboard" nodeId={item.key} components={DATA_BLOCKS} />)

Your own keys still only appear if they're in `fallback`. Added blocks are recognizable by
their key (Patina gives every inserted node a `u_` key, which base items never use), so an
unknown key of yours is still dropped. Previews show new blocks in place.

## Type Parameters

### K

`K` *extends* `string`

## Parameters

### surfaceId

`string`

### nodeId

`string`

### prop

`string`

### fallback

readonly `K`[]

### options?

[`HookOptions`](../interfaces/HookOptions.md)\<`K`\>

## Returns

[`SlotItem`](../type-aliases/SlotItem.md)\<`K`\>[]
