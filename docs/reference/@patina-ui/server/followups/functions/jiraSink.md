[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / jiraSink

# Function: jiraSink()

> **jiraSink**(`options`): [`FollowUpSink`](../interfaces/FollowUpSink.md)

Files one Jira issue per follow-up, and comments on it when it's asked for again. The
follow-up key is stored as a label (e.g. "pf-0123456789"), so later runs find the issue.

## Parameters

### options

[`JiraSinkOptions`](../interfaces/JiraSinkOptions.md)

## Returns

[`FollowUpSink`](../interfaces/FollowUpSink.md)
