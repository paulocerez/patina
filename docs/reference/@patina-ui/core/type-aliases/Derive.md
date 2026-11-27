[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / Derive

# Type Alias: Derive

> **Derive** = \{ `from`: `string`; `op`: `"weekday"`; `timeZone?`: `string`; \} \| \{ `from`: `string`; `op`: `"hour"`; `timeZone?`: `string`; \} \| \{ `from`: `string`; `op`: `"ranges"`; `ranges`: `object`[]; \} \| \{ `any`: `string`[]; `from`: `string`; `op`: `"contains"`; \}

A field computed in the browser from another field of the same row, so users can group and
filter by things the endpoint doesn't return as such ("calls by weekday", "short vs. long",
"emergencies"). Declarative: Patina evaluates it, the host writes no code.

## Union Members

### Type Literal

\{ `from`: `string`; `op`: `"weekday"`; `timeZone?`: `string`; \}

Day of the week of a date field: "mon" … "sun".

***

### Type Literal

\{ `from`: `string`; `op`: `"hour"`; `timeZone?`: `string`; \}

Hour of a date field: "00" … "23".

***

### Type Literal

\{ `from`: `string`; `op`: `"ranges"`; `ranges`: `object`[]; \}

Which range a number falls in. Ranges are tried in order; a value below `below` gets that
range's `value`. The last range has no `below` and takes everything else.

***

### Type Literal

\{ `any`: `string`[]; `from`: `string`; `op`: `"contains"`; \}

Whether a text field contains any of these words (case-insensitive).
