[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / FieldKind

# Type Alias: FieldKind

> **FieldKind** = `"string"` \| `"number"` \| `"currency"` \| `"date"` \| `"enum"` \| `"bool"`

The data catalog: read-only data sources the host already exposes, which users may compose
into new views. Generated as a draft by `patina scan`, reviewed and committed by developers.

The catalog is an allowlist. Patina never adds endpoints or queries: blocks fetch these
GET endpoints from the browser with the user's own session, so the host's API stays the
authority over what each user can see.
