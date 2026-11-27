[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / Restriction

# Interface: Restriction

What to take away from a manifest for one request (see `restrict`).

## Properties

### fields?

> `optional` **fields?**: `string`[]

Catalog fields to remove, as "source.field".

***

### keys?

> `optional` **keys?**: `string`[]

Collection keys and sort keys to remove everywhere (e.g. a "revenue" column).

***

### nodes?

> `optional` **nodes?**: `string`[]

Nodes to remove entirely.

***

### permissions?

> `optional` **permissions?**: `string`[]

The user's permissions, checked against catalog `requires`. Set by the handler from `ctx.permissions`.

***

### presets?

> `optional` **presets?**: `string`[]

Presets the user may not insert.

***

### sources?

> `optional` **sources?**: `string`[]

Catalog sources to remove.

***

### values?

> `optional` **values?**: `Record`\<`string`, `string`[]\>

This tenant's values for text fields, as "source.field" → values. The field becomes an
enum for this request, so views can filter on it ("calls of the Emergency task") and the
model knows the values. Use it for values each tenant names itself.
