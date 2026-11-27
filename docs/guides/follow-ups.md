# Follow-ups: tickets from what customers asked for

[Insights](insights.md) show what customers asked for but couldn't get. Follow-ups send that
to where your team works:

- **Linear:** one issue per request. When customers ask for it again, the next run adds a
  comment to the same issue instead of filing a new one.
- **Slack:** one digest message per run that links the issues.
- **Your own sink:** a webhook, or any object with a `deliver` method (Jira, GitHub Issues, email).

Follow-ups read the request log, so storage has to keep it: `postgresStorage` or
`memoryStorage`, with `logRequests` left on. They need no other table: Linear issues carry a
marker (`patina-followup:pf-…`), and later runs find them by it.

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

## Other sinks

```ts
import {
  webhookSink,
  renderFollowUpMarkdown,
  type FollowUpSink,
} from "@patina-ui/server/followups";

webhookSink({ url: "https://hooks.zapier.com/…" }); // POSTs { followUps, deliveries }

const githubIssues: FollowUpSink = {
  name: "github",
  async deliver(items) {
    // Search for the marker, then create or comment. renderFollowUpMarkdown(f) is the body.
    return [];
  },
};
```
