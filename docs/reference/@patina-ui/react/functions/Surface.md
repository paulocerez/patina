[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / Surface

# Function: Surface()

> **Surface**(`__namedParameters`): `Element`

Renders a surface from its resolved spec (or from the pending preview).

Host components receive plain props: slot props arrive as ordered `ReactNode[]` with hidden
children removed, and collection props arrive as ordered arrays with hidden items removed.
Values are only ever passed as props; nothing is injected as HTML.

## Parameters

### \_\_namedParameters

[`SurfaceProps`](../interfaces/SurfaceProps.md)

## Returns

`Element`
