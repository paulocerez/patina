[Patina API reference](../../../../README.md) / [@patina-ui/server/integrations](../README.md) / PostHogClientLike

# Interface: PostHogClientLike

The part of posthog-node's client Patina uses.

## Methods

### capture()

> **capture**(`message`): `unknown`

#### Parameters

##### message

###### distinctId

`string`

###### event

`string`

###### groups?

`Record`\<`string`, `string`\>

###### properties?

`Record`\<`string`, `unknown`\>

###### timestamp?

`Date`

#### Returns

`unknown`
