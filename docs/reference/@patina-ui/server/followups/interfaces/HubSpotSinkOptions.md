[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / HubSpotSinkOptions

# Interface: HubSpotSinkOptions

## Properties

### apiUrl?

> `optional` **apiUrl?**: `string`

Default https://api.hubapi.com.

***

### appName?

> `optional` **appName?**: `string`

Shown in the note ("… in Vetpal").

***

### fetch?

> `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`RequestInfo` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` \| `Request` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

***

### token

> **token**: `string`

A private app token with crm.objects.notes.write and crm.objects.companies.read.

## Methods

### companyId()

> **companyId**(`tenantId`): `string` \| `Promise`\<`string` \| `null` \| `undefined`\> \| `null` \| `undefined`

The HubSpot company id for a tenant, or null to skip that customer.

#### Parameters

##### tenantId

`string`

#### Returns

`string` \| `Promise`\<`string` \| `null` \| `undefined`\> \| `null` \| `undefined`
