[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / mentions

# Function: mentions()

> **mentions**(`text`, `phrase`): `boolean`

Whether `text` names `phrase`: every word of the phrase appears, in order and next to each
other, after stemming. Compound words count when the phrase is one word of at least five
letters ("Anrufzusammenfassung" names "Zusammenfassung").

## Parameters

### text

`string`

### phrase

`string`

## Returns

`boolean`
