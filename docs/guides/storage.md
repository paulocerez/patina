# Storage

Patina stores each user's customization history, plus short-lived proposals (previews that
haven't been applied yet). Pick an adapter, or write your own.

## `memoryStorage()`

In-process and lost on restart. Use it for tests, demos and trying things out.

## `postgresStorage({ query })`

```ts
import { Pool } from "pg";
import { migratePostgres, postgresStorage } from "@patina-ui/server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = (sql: string, params?: unknown[]) => pool.query(sql, params);

await migratePostgres(query); // idempotent: create table if not exists …
const storage = postgresStorage({ query });
```

`query` is any `(sql, params) => Promise<{ rows }>`, so Patina imports no driver:

| Driver      | `query`                                                              |
| ----------- | -------------------------------------------------------------------- |
| `pg`        | `(sql, params) => pool.query(sql, params)`                           |
| PGlite      | `(sql, params) => db.query(sql, params)`                             |
| postgres.js | `async (text, params) => ({ rows: await sql.unsafe(text, params) })` |

### Only the tables you use

Every table but `patina_history` belongs to an optional feature. Turn off what you don't use,
and pass the same options to `migratePostgres` (or `postgresSchema`) and `postgresStorage`:

```ts
const features = { previews: "memory", requestLog: false, usage: false, followUps: false } as const;
await migratePostgres(query, features); // only patina_history
const storage = postgresStorage({ query, ...features });
```

| Option               | Table              | What you lose without it                                                                         |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `previews: "memory"` | `patina_proposals` | Nothing on one server. With several, an Apply that reaches another one gets a 409 and is retried |
| `requestLog: false`  | `patina_requests`  | [Insights](insights.md) and [follow-ups](follow-ups.md): you can't see what users asked for      |
| `usage: false`       | `patina_usage`     | Monthly [quotas](availability.md#quotas)                                                         |
| `followUps: false`   | `patina_followups` | "It's now possible" notices for [shipped follow-ups](follow-ups.md#telling-users-when-it-ships)  |

**Keep the request log on while you introduce a surface.** It's how you see what users try
to do, what gets refused and why, which tells you what to open up next. Turn it off later if
you don't need it.

### In your own migrations

`postgresSchema(features)` returns the SQL for those tables (`POSTGRES_SCHEMA` is all of
them), to copy into a migration instead of calling `migratePostgres`.

**With Drizzle**, re-export the tables from your schema file and let `drizzle-kit generate`
write the migration. They create exactly what the SQL creates, constraint names included:

```ts
// db/schema.ts
export { patinaHistory } from "@patina-ui/server/drizzle";
// and patinaProposals, patinaRequests, patinaUsage, patinaFollowups for the features you use
```

The tables:

- **`patina_history`**: append-only, one row per patch, undo (`revert`) or `reset`. Each patch
  row keeps the ops, the user's original prompt, the summary and the model ID. The unique
  `(tenant_id, layer, subject_id, surface_id, seq)` constraint provides optimistic
  concurrency between devices.
- **`patina_proposals`**: previews waiting to be applied. They are single-use, scoped to the
  user, and expire (15 minutes by default). Expired rows are cleaned up on write.

- **`patina_requests`**: the request log, one row per customization request with its outcome
  and reason. It feeds [Insights](insights.md).
- **`patina_usage`**: monthly counters for [quotas](availability.md#quotas).

### Prompt retention

Stored prompts can contain personal data. Clear old ones from a scheduled job:

```ts
const cleared = await storage.redactPrompts(new Date(Date.now() - 90 * 86_400_000));
```

This keeps the ops and summary (the view is unaffected) and nulls the prompt text, both in
saved customizations and in the request log.
`memoryStorage()` has the same method.

## Writing an adapter

Implement `StorageAdapter`:

```ts
interface StorageAdapter {
  list(key: HistoryKey): Promise<Entry[]>; // ordered by seq
  append(key: HistoryKey, entry: NewEntry, expectedSeq: number): Promise<Entry>; // ConflictError if head ≠ expectedSeq
  saveProposal(proposal: Proposal): Promise<void>;
  takeProposal(id: string, key: HistoryKey): Promise<Proposal | null>; // delete-and-return; null if foreign or expired
}
```

The repo runs one contract suite against every adapter
(`packages/server/test/storage-contract.ts`). Run it against yours too.

## Layers and keys

A history is identified by `{ tenantId, layer, subjectId, surfaceId }`. The handler writes the
`user` layer, with `subjectId = userId`. It also reads a `tenant` layer, with
`subjectId = tenantId`, if one exists, and applies it before the user's patches. That's where
organization-wide defaults will live. To experiment with it today, append patches to that
key yourself.
