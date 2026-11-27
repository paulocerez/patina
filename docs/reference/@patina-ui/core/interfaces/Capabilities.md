[Patina API reference](../../../README.md) / [@patina-ui/core](../README.md) / Capabilities

# Interface: Capabilities

What this user can ask for on a surface, in their language: built from the restricted
manifest (after `restrict` and permissions) and the public catalog, never by the model.
Sent with every `SurfaceState` and used in refusals.

## Properties

### arrange

> **arrange**: [`ArrangeCapability`](ArrangeCapability.md)[]

Lists that can be reordered, hidden or added to (page sections, columns, cards…).

***

### data

> **data**: [`DataCapability`](DataCapability.md)[]

Data that can be added as new views (tables, charts, numbers). Empty without a catalog or
when data views are off for this user. Sensitive fields never appear.

***

### settings

> **settings**: [`SettingCapability`](SettingCapability.md)[]

Settings with the values they can take.
