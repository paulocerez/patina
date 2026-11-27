[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / GitHubIssuesSinkOptions

# Interface: GitHubIssuesSinkOptions

## Properties

### apiUrl?

> `optional` **apiUrl?**: `string`

Default https://api.github.com (set it for GitHub Enterprise Server).

***

### appName?

> `optional` **appName?**: `string`

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

### labels?

> `optional` **labels?**: `string`[]

Labels for new issues. The first one is how later runs find them. Default ["patina-followup"].

***

### onClosed?

> `optional` **onClosed?**: `"comment"` \| `"skip"`

For closed issues: add a comment (default) or ignore the new requests.

***

### repo

> **repo**: `string`

"owner/name".

***

### titlePrefix?

> `optional` **titlePrefix?**: `string`

Default "Customer request: ".

***

### token

> **token**: `string`

A fine-grained token with Issues: read and write on the repository.
