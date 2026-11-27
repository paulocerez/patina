[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / JiraSinkOptions

# Interface: JiraSinkOptions

## Properties

### apiToken

> **apiToken**: `string`

An Atlassian API token (id.atlassian.com → Security → API tokens).

***

### appName?

> `optional` **appName?**: `string`

***

### baseUrl

> **baseUrl**: `string`

e.g. "https://your-team.atlassian.net".

***

### email

> **email**: `string`

The Atlassian account email the API token belongs to.

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

### issueType?

> `optional` **issueType?**: `string`

Default "Task".

***

### labels?

> `optional` **labels?**: `string`[]

Labels for new issues. The first one is how later runs find them. Default ["patina-followup"].

***

### onClosed?

> `optional` **onClosed?**: `"comment"` \| `"skip"`

For done issues: add a comment (default) or ignore the new requests.

***

### projectKey

> **projectKey**: `string`

***

### titlePrefix?

> `optional` **titlePrefix?**: `string`

Default "Customer request: ".
