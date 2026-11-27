[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / SlackSinkOptions

# Interface: SlackSinkOptions

## Properties

### appName?

> `optional` **appName?**: `string`

Shown in the header ("Vetpal: what customers couldn't do this week").

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

### insightsUrl?

> `optional` **insightsUrl?**: `string`

Link to your insights page or dashboard, shown at the bottom.

***

### webhookUrl

> **webhookUrl**: `string`

An incoming-webhook URL (a Slack app with "Incoming Webhooks", bound to one channel).
