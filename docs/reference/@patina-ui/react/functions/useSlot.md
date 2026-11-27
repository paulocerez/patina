[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / useSlot

# Function: useSlot()

> **useSlot**\<`K`\>(`surfaceId`, `nodeId`, `prop`, `fallback`, `options?`): `K`[]

The ordered, visible keys of a slot, for pages that keep their own JSX:

  const sections = useSlot("dashboard", "overview", "sections", ["metrics", "chart", "calls"]);
  return <>{sections.map((key) => <Fragment key={key}>{SECTIONS[key]}</Fragment>)}</>;

Returns `fallback` (your default order) while loading, without a `<PatinaProvider>` (e.g. when
customizing is behind a flag that's off) or if the node doesn't exist. Keys that aren't in
`fallback` are dropped, so the page only ever renders sections it knows.

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

`K`[]
