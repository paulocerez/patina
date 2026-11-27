[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / PerCustomerSinkOptions

# Interface: PerCustomerSinkOptions

## Properties

### name

> **name**: `string`

## Methods

### notify()

> **notify**(`tenantId`, `followUps`): `Promise`\<`false` \| \{ `ref?`: `string`; `url?`: `string`; \} \| `undefined`\>

Called once per customer (tenant) with the follow-ups that customer asked for. The tenant
id stays on your server; map it to your CRM yourself. Return false if this customer was
skipped (e.g. not in your CRM): no delivery is reported for it.

#### Parameters

##### tenantId

`string`

##### followUps

[`FollowUp`](FollowUp.md)[]

#### Returns

`Promise`\<`false` \| \{ `ref?`: `string`; `url?`: `string`; \} \| `undefined`\>
