[Patina API reference](../../../README.md) / [@patina/cli](../README.md) / checkRepo

# Function: checkRepo()

> **checkRepo**(`root`, `options?`): [`CheckReport`](../interfaces/CheckReport.md)

Compares the repo as it is now with what Patina was set up against: the committed
`patina/scan.json` snapshot and the hand-reviewed `patina/catalog.ts`.

- breaking: something the catalog relies on is gone or changed type, so saved data views
  using it will stop showing data.
- changed: the API or design system changed in a way the catalog/blocks may want to follow.
- info: things worth knowing (new fields not offered yet, …).

## Parameters

### root

`string`

### options?

#### outDir?

`string`

## Returns

[`CheckReport`](../interfaces/CheckReport.md)
