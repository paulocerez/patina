[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / LinearSinkOptions

# Interface: LinearSinkOptions

## Properties

### apiKey

> **apiKey**: `string`

A Linear API key (Settings → Security & access → Personal API keys).

***

### appName?

> `optional` **appName?**: `string`

Shown in the ticket ("… in Vetpal").

***

### endpoint?

> `optional` **endpoint?**: `string`

Default https://api.linear.app/graphql.

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

### labelIds?

> `optional` **labelIds?**: `string`[]

Labels for new issues, e.g. a "customer request" label.

***

### onClosed?

> `optional` **onClosed?**: `"comment"` \| `"skip"`

What to do when the matching issue is done or canceled. "comment" (default) adds the new
requests as a comment, which tells you it still isn't possible for customers; "skip" ignores them.

***

### priority?

> `optional` **priority?**: `number`

Linear priority 0–4 (0 none, 1 urgent … 4 low). Default 0.

***

### stateId?

> `optional` **stateId?**: `string`

Workflow state for new issues (e.g. Triage). Default: the team's default.

***

### teamId

> **teamId**: `string`

The team new issues go to (its UUID).

***

### titlePrefix?

> `optional` **titlePrefix?**: `string`

Prefix for titles. Default "Customer request: ".
