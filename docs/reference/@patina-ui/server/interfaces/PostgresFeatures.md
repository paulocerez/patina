[Patina API reference](../../../README.md) / [@patina-ui/server](../README.md) / PostgresFeatures

# Interface: PostgresFeatures

Which optional parts of Patina's storage you use. Everything is on by default.

## Properties

### followUps?

> `optional` **followUps?**: `boolean`

Shipped-follow-up notices (table patina_followups). Default true.

***

### previews?

> `optional` **previews?**: `"postgres"` \| `"memory"`

Where previews (proposals) live between "preview" and "apply": "postgres" (default) or
"memory". Memory needs no table; with several server instances, an Apply that reaches
another instance than the preview gets a 409 and the user asks again.

***

### requestLog?

> `optional` **requestLog?**: `boolean`

The request log, for insights and follow-ups (table patina_requests). Default true.

***

### usage?

> `optional` **usage?**: `boolean`

Monthly quota counters (table patina_usage). Default true.
