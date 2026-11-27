# Follow-ups: tickets from what customers asked for

[Insights](insights.md) show what customers asked for but couldn't get. Follow-ups send that
to where your team works:

- **Linear, GitHub Issues or Jira:** one issue per request. When customers ask for it again, the next run adds a
  comment to the same issue instead of filing a new one.
- **Slack:** one digest message per run that links the issues.
- **HubSpot:** a note on each customer's company for the account manager.
- **Your own sink:** a webhook, or any object with a `deliver` method.

And when an issue is completed, the users who asked are told in the app
([below](#telling-users-when-it-ships)).

Follow-ups read the request log, so storage has to keep it: `postgresStorage` or
`memoryStorage`, with `logRequests` left on. Filing needs no other table: issues carry a marker
(`patina-followup:pf-…`), and later runs find them by it. Telling users when it ships needs one
(`patina_followups`, created by `migratePostgres`).

## Run it on a schedule

From the CLI, e.g. weekly in GitHub Actions or your own cron:

```sh
LINEAR_API_KEY=… SLACK_WEBHOOK_URL=… DATABASE_URL=… \
  npx patina followups --since 7d --linear-team <team id> --linear-label <label id> --group
```

```yaml
# .github/workflows/patina-followups.yml
on:
  schedule: [{ cron: "0 7 * * 1" }] # Mondays 07:00 UTC
  workflow_dispatch:
jobs:
  followups:
    runs-on: ubuntu-latest
    steps:
      - run: npx -y -p @patina-ui/cli -p pg patina followups --since 7d --group
        env:
          DATABASE_URL: ${{ secrets.PATINA_DATABASE_URL }}
          LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
          LINEAR_TEAM_ID: ${{ vars.LINEAR_TEAM_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Match `--since` to the interval, so each request is counted once. Use `--dry-run` to see what
would be filed without sending anything.

Or from code:

```ts
import { linearSink, runFollowUps, slackSink } from "@patina-ui/server/followups";
import { anthropicGrouper } from "@patina-ui/server/anthropic";

const run = await runFollowUps({
  storage,
  since: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  grouper: anthropicGrouper({ language: "German", appDescription: "Practice software for vets" }),
  customerName: async (tenantId) => (await db.account.find(tenantId))?.name ?? null,
  sinks: [
    linearSink({
      apiKey: process.env.LINEAR_API_KEY!,
      teamId: "…",
      labelIds: ["…"],
      appName: "Vetpal",
    }),
    slackSink({ webhookUrl: process.env.SLACK_WEBHOOK_URL!, appName: "Vetpal" }),
  ],
});
```

Sinks run in order: put Linear before Slack so the digest can link the issues. If one sink
fails, the others still run, and the CLI exits with 1.

## What gets filed

Only requests that point at something to build: the reasons `new_component`, `styling`,
`action`, `not_on_page`, and the validator's `preset_not_allowed`, `not_customizable`,
`unknown_prop`, `invalid_value` and `cannot_remove_base_item` (`DEMAND_REASONS`). Requests for
other people's data (`data_access`), safety refusals, unclear prompts, quotas and errors are
left out. To send plan-related requests (`data_views_off`, `customize_off`) to sales, run a
second job with `reasons: ["data_views_off"]` and a different sink.

A request becomes a follow-up when it was asked at least `minRequests` times (default 2) by at
least `minCustomers` customers (default 1) in the window. At most `maxItems` (default 10) are
filed per run, ordered by the number of customers first.

**Grouping.** Without a grouper, requests are grouped by wording after lowercasing and removing
punctuation and polite filler, so "Export to Excel" and "please export to excel!" are one
request, but "Excel-Export" is another. `anthropicGrouper()` (`--group` in the CLI) asks Claude
(Sonnet 5.5 by default, one call per run) to merge requests that want the same thing in any
wording or language. It also writes the titles and summaries in `language`, and matches
requests to issues already filed.

**An issue** has the title, a summary (with a grouper), how often and by how many customers it
was asked, up to five example wordings, the reasons, and the surfaces. Customer names appear
only if you pass `customerName`. If the issue was completed or canceled and customers still ask
for it, the comment says so; `onClosed: "skip"` ignores those requests instead.

## Privacy

The prompts are what your users typed, and follow-ups send them to Linear, Slack and, with a
grouper, Anthropic.

- Prompts are run through `redact` before they leave your server. It replaces email addresses,
  links, IBANs, phone numbers and other long numbers. Pass your own `redact` to remove more,
  such as patient or customer names, or return `null` to leave an example out.
- No user ids or tenant ids are sent. Customer names are sent only if you pass `customerName`.
- Check that Linear, Slack and Anthropic are covered by your data processing agreements before
  you turn this on.

## Telling users when it ships

When a follow-up reaches a tracker, Patina remembers who asked for it (storage table
`patina_followups`: follow-up key, tenant, user, surface). When the issue is completed, those
users see a notice on the page where they asked:

> Sie hatten sich „No-Show-Quote pro Tierarzt anzeigen“ gewünscht. Das ist jetzt möglich. [Ausblenden]

**1. Show notices** with `<ShippedNotice>` (or `useSurface(id).notices` for your own UI):

```tsx
<ShippedNotice surfaceId="dashboard" className="…" />;
```

**2. Mark follow-ups as shipped** with your tracker's webhook. The handler checks the signature
and ignores everything except completed follow-up issues (not "not planned" or canceled ones):

```ts
import { followUpWebhook } from "@patina-ui/server/followups";
import { toExpress } from "@patina-ui/server/express";

// Before express.json(): the signature is computed over the raw body.
app.post(
  "/webhooks/linear",
  toExpress(
    followUpWebhook({ provider: "linear", secret: process.env.LINEAR_WEBHOOK_SECRET!, storage }),
  ),
);
```

| Tracker | Set up                                                           | Ships when                                 |
| ------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Linear  | Settings → API → Webhooks, "Issues", copy the signing secret     | the issue moves to a completed state       |
| GitHub  | Repository → Settings → Webhooks, JSON, event "Issues", a secret | the issue is closed as completed           |
| Jira    | System → WebHooks, event "Issue updated", a secret               | the issue's status is in the Done category |

Or by hand: `patina followups ship pf-0123456789 --message "Die No-Show-Quote finden Sie jetzt unter Statistik."`.
Without `message`, users get Patina's text with the follow-up's title, in their language.

The notice appears until the user dismisses it. Only users who asked for the follow-up in a run
that reached a tracker are notified; dry runs don't link anyone.

## More sinks

### GitHub Issues

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

### Jira

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

### HubSpot: tell the account manager

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

### Webhook or your own

```ts
import {
  webhookSink,
  renderFollowUpMarkdown,
  type FollowUpSink,
} from "@patina-ui/server/followups";

webhookSink({ url: "https://hooks.zapier.com/…" }); // POSTs { followUps, deliveries }, without user ids

const mySink: FollowUpSink = {
  name: "email",
  async deliver(items) {
    // renderFollowUpMarkdown(f) is a ready-made body.
    return items.map((f) => ({ sink: "email", key: f.key, action: "posted" }));
  },
};
```

From the CLI, GitHub and Jira work like Linear: `--github-repo owner/name` with `GITHUB_TOKEN`,
or `--jira-project KEY` with `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN`.
