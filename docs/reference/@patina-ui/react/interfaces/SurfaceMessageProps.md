[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / SurfaceMessageProps

# Interface: SurfaceMessageProps

## Properties

### children?

> `optional` **children?**: (`message`, `actions`) => `ReactNode`

Custom rendering. `message.options` (clarify) are the choices to offer; call `pick(label)`
to send one. `message.capabilities` (answer) is what the user can change.

#### Parameters

##### message

[`SurfaceMessageData`](SurfaceMessageData.md)

##### actions

###### pick

(`label`) => `void`

#### Returns

`ReactNode`

***

### className?

> `optional` **className?**: `string`

***

### surfaceId

> **surfaceId**: `string`
