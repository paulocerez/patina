[Patina API reference](../../../README.md) / @patina-ui/server/followups

# @patina-ui/server/followups

Follow-ups: turn what customers asked for but couldn't get into tickets and digests
(Linear, Slack, or your own sink). Built on the request log, like insights.

Run it on a schedule (a weekly cron or GitHub Actions `schedule`) with `runFollowUps`, or
from the CLI with `patina followups`. Each run looks at one window of the log, groups the
unmet requests, keeps the ones asked often enough, and hands them to every sink. Sinks
de-duplicate on their side (Linear comments on the existing issue instead of filing a new one),
so Patina needs no extra table for this.

## Interfaces

- [AdfDoc](interfaces/AdfDoc.md)
- [Delivery](interfaces/Delivery.md)
- [FollowUp](interfaces/FollowUp.md)
- [FollowUpGroup](interfaces/FollowUpGroup.md)
- [FollowUpOptions](interfaces/FollowUpOptions.md)
- [FollowUpRun](interfaces/FollowUpRun.md)
- [FollowUpSink](interfaces/FollowUpSink.md)
- [FollowUpWebhookOptions](interfaces/FollowUpWebhookOptions.md)
- [GitHubIssuesSinkOptions](interfaces/GitHubIssuesSinkOptions.md)
- [HubSpotSinkOptions](interfaces/HubSpotSinkOptions.md)
- [JiraSinkOptions](interfaces/JiraSinkOptions.md)
- [KnownFollowUp](interfaces/KnownFollowUp.md)
- [LinearSinkOptions](interfaces/LinearSinkOptions.md)
- [PerCustomerSinkOptions](interfaces/PerCustomerSinkOptions.md)
- [RequestCluster](interfaces/RequestCluster.md)
- [Requester](interfaces/Requester.md)
- [SlackSinkOptions](interfaces/SlackSinkOptions.md)

## Type Aliases

- [FollowUpGrouper](type-aliases/FollowUpGrouper.md)

## Variables

- [DEMAND\_REASONS](variables/DEMAND_REASONS.md)

## Functions

- [apiError](functions/apiError.md)
- [askedAgainMarkdown](functions/askedAgainMarkdown.md)
- [buildFollowUps](functions/buildFollowUps.md)
- [followUpKey](functions/followUpKey.md)
- [followUpMarker](functions/followUpMarker.md)
- [followUpWebhook](functions/followUpWebhook.md)
- [githubIssuesSink](functions/githubIssuesSink.md)
- [hubspotSink](functions/hubspotSink.md)
- [jiraSink](functions/jiraSink.md)
- [linearSink](functions/linearSink.md)
- [markdownToAdf](functions/markdownToAdf.md)
- [parseFollowUpMarker](functions/parseFollowUpMarker.md)
- [perCustomerSink](functions/perCustomerSink.md)
- [redact](functions/redact.md)
- [renderCustomerNoteHtml](functions/renderCustomerNoteHtml.md)
- [renderFollowUpMarkdown](functions/renderFollowUpMarkdown.md)
- [renderFollowUpsText](functions/renderFollowUpsText.md)
- [renderSlackDigest](functions/renderSlackDigest.md)
- [runFollowUps](functions/runFollowUps.md)
- [shipFollowUp](functions/shipFollowUp.md)
- [slackSink](functions/slackSink.md)
- [webhookSink](functions/webhookSink.md)
