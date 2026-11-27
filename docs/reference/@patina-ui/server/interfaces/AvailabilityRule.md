[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / AvailabilityRule

# Interface: AvailabilityRule

What a user may do on a surface. Returned by the `availability` hook; every field is optional.

## Properties

### customize?

> `optional` **customize?**: `boolean`

May change this view at all: prompt, apply, undo, reset. Default true.

***

### dataViews?

> `optional` **dataViews?**: `boolean`

May create or edit data views (charts, tables and cards from the catalog). Default true.

***

### message?

> `optional` **message?**: `string`

Shown to the user when something is unavailable.

***

### whenOff?

> `optional` **whenOff?**: `"base"` \| `"keep"`

What users who lose access see.
- "keep" (default): their saved customizations stay; they just can't make new ones.
- "base": they see the default view; their history is kept and comes back if access does.
