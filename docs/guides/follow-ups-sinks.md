## GitHub Issues

```ts
import { githubIssuesSink } from "@patina-ui/server/followups";

githubIssuesSink({
  token: process.env.GITHUB_TOKEN!, // fine-grained token: Issues read and write on the repo
  repo: "your-org/product",
  labels: ["patina-followup", "customer-request"], // default ["patina-followup"]
  appName: "Vetpal",
});
```

One issue per follow-up, with the same body as the Linear issue. Later runs find the issues by
listing the first label (open and closed), so keep that label on them. When customers ask
again, the run adds a comment. If the issue was closed as completed, the comment says it's
still asked for; `onClosed: "skip"` ignores those requests instead. Issues closed as "not
planned" aren't offered to the grouper, so new requests for them get a new issue. Set `apiUrl`
for GitHub Enterprise Server.

## Jira

```ts
import { jiraSink } from "@patina-ui/server/followups";

jiraSink({
  baseUrl: "https://your-team.atlassian.net",
  email: "bot@your-company.com",
  apiToken: process.env.JIRA_API_TOKEN!, // id.atlassian.com → Security → API tokens
  projectKey: "VP",
  issueType: "Task", // default
});
```

The account needs permission to browse the project, create issues and add comments. Each
issue gets the label `patina-followup` and a second label with the follow-up's key (e.g.
`pf-0123456789`), which is how later runs find it. Issues in a "Done" status category count
as closed. The description is the follow-up converted to Atlassian Document Format;
`markdownToAdf` is exported if you build your own Jira calls.

## HubSpot: tell the account manager

```ts
import { hubspotSink } from "@patina-ui/server/followups";

hubspotSink({
  token: process.env.HUBSPOT_TOKEN!, // private app: crm.objects.notes.write, crm.objects.companies.read
  companyId: async (tenantId) => (await db.account.find(tenantId))?.hubspotCompanyId ?? null,
  appName: "Vetpal",
});
```

This sink works per customer, not per follow-up: each customer with a HubSpot company gets one
note on that company listing what they asked for, how often, and an example. Customers without a
company id are skipped. Tenant ids never leave your server: `companyId` maps them.

For another CRM (Intercom, Salesforce, Pipedrive), use the same building block:

```ts
import { perCustomerSink } from "@patina-ui/server/followups";

perCustomerSink({
  name: "intercom",
  async notify(tenantId, followUps) {
    const company = await crm.companyFor(tenantId);
    if (!company) return false; // skipped: no delivery reported
    await crm.addNote(company.id, followUps.map((f) => f.title).join("\n"));
    return { ref: company.id };
  },
});
```
