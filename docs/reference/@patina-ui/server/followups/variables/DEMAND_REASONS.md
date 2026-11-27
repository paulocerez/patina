[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / DEMAND\_REASONS

# Variable: DEMAND\_REASONS

> `const` **DEMAND\_REASONS**: `string`[]

Reasons that point at something to build. Left out by default: data_access (a permission
boundary, not demand), safety, unclear, no_change, quotas, rate limits, errors, and the
plan/availability reasons (pass them in `reasons` to send sales signals instead).
