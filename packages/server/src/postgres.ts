import type { Op } from "@patina-ui/core";
import {
  ConflictError,
  type Entry,
  type HistoryKey,
  type NewEntry,
  type Proposal,
  type RequestEvent,
  type StorageAdapter,
} from "./storage.js";

/**
 * Any function that runs a parameterized query and returns rows: `pg`'s `pool.query`,
 * PGlite's `db.query`, or a two-line shim around postgres.js. Patina imports no driver.
 */
export type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

/** The schema. Run it once with `migratePostgres(query)`, or copy it into your own migrations. */
export const POSTGRES_SCHEMA = `
create table if not exists patina_history (
  id             text        primary key,
  tenant_id      text        not null default '',
  layer          text        not null check (layer in ('user', 'tenant')),
  subject_id     text        not null,
  surface_id     text        not null,
  seq            integer     not null,
  kind           text        not null check (kind in ('patch', 'revert', 'reset')),
  target_id      text        null references patina_history(id),
  schema_version integer     null,
  base_version   integer     null,
  ops            jsonb       null,
  prompt         text        null,
  summary        text        null,
  model          text        null,
  created_at     timestamptz not null default now(),
  unique (tenant_id, layer, subject_id, surface_id, seq)
);

create table if not exists patina_proposals (
  id          text        primary key,
  tenant_id   text        not null default '',
  layer       text        not null,
  subject_id  text        not null,
  surface_id  text        not null,
  base_seq    integer     not null,
  ops         jsonb       not null,
  summary     text        not null,
  prompt      text        not null,
  model       text        not null,
  expires_at  timestamptz not null
);
create index if not exists patina_proposals_expires_at on patina_proposals (expires_at);

create table if not exists patina_requests (
  id           text        primary key,
  created_at   timestamptz not null default now(),
  tenant_id    text        not null default '',
  surface_id   text        not null,
  user_id      text        not null,
  prompt       text        null,       -- the user's words (retention: redactPrompts)
  outcome      text        not null,
  reason       text        null,
  source       text        null,
  message      text        null,
  proposal_id  text        null,
  model        text        null,
  latency_ms   integer     null,
  model_calls  integer     null
);
create index if not exists patina_requests_created_at on patina_requests (created_at);
create index if not exists patina_requests_tenant on patina_requests (tenant_id, created_at);

create table if not exists patina_usage (
  tenant_id   text    not null default '',
  subject_id  text    not null,
  period      text    not null,
  count       integer not null default 0,
  primary key (tenant_id, subject_id, period)
);
`;

export async function migratePostgres(query: QueryFn): Promise<void> {
  for (const statement of POSTGRES_SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    await query(statement);
  }
}

const iso = (v: unknown) =>
  v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
const json = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

function toEntry(r: Record<string, unknown>): Entry {
  const common = { id: r.id as string, seq: Number(r.seq), createdAt: iso(r.created_at) };
  if (r.kind === "revert") return { ...common, kind: "revert", targetId: r.target_id as string };
  if (r.kind === "reset") return { ...common, kind: "reset" };
  return {
    ...common,
    kind: "patch",
    patch: {
      id: r.id as string,
      schemaVersion: Number(r.schema_version) as 1,
      baseVersion: Number(r.base_version),
      ops: json(r.ops) as Op[],
      ...(r.summary ? { summary: r.summary as string } : {}),
    },
    prompt: (r.prompt as string | null) ?? null,
    summary: (r.summary as string | null) ?? null,
    model: (r.model as string | null) ?? null,
  };
}

const keyParams = (k: HistoryKey) => [k.tenantId ?? "", k.layer, k.subjectId, k.surfaceId];

/**
 * Postgres storage. History is append-only; `append` uses the unique
 * `(tenant_id, layer, subject_id, surface_id, seq)` constraint for optimistic concurrency.
 */
export function postgresStorage({ query }: { query: QueryFn }): StorageAdapter &
  Required<Pick<StorageAdapter, "incrementUsage" | "logRequest" | "listRequests">> & {
    /** Clears stored prompts older than `before` (prompt retention). Returns the number of rows changed. */
    redactPrompts(before: Date): Promise<number>;
  } {
  return {
    async list(key) {
      const { rows } = await query(
        `select * from patina_history
         where tenant_id = $1 and layer = $2 and subject_id = $3 and surface_id = $4
         order by seq`,
        keyParams(key),
      );
      return rows.map(toEntry);
    },

    async append(key, entry: NewEntry, expectedSeq) {
      const patch = entry.kind === "patch" ? entry.patch : null;
      try {
        const { rows } = await query(
          `insert into patina_history
             (id, tenant_id, layer, subject_id, surface_id, seq, kind, target_id,
              schema_version, base_version, ops, prompt, summary, model)
           select $1, $2, $3, $4, $5, $6::integer + 1, $7, $8, $9, $10, $11::jsonb, $12, $13, $14
           where (select coalesce(max(seq), 0) from patina_history
                  where tenant_id = $2 and layer = $3 and subject_id = $4 and surface_id = $5) = $6::integer
           returning *`,
          [
            entry.id,
            ...keyParams(key),
            expectedSeq,
            entry.kind,
            entry.kind === "revert" ? entry.targetId : null,
            patch?.schemaVersion ?? null,
            patch?.baseVersion ?? null,
            patch ? JSON.stringify(patch.ops) : null,
            entry.kind === "patch" ? (entry.prompt ?? null) : null,
            entry.kind === "patch" ? (entry.summary ?? patch?.summary ?? null) : null,
            entry.kind === "patch" ? (entry.model ?? null) : null,
          ],
        );
        if (!rows[0]) throw new ConflictError();
        return toEntry(rows[0]);
      } catch (e) {
        // 23505 = unique_violation: another writer took this seq first.
        if ((e as { code?: string }).code === "23505") throw new ConflictError();
        throw e;
      }
    },

    async saveProposal(p: Proposal) {
      await query("delete from patina_proposals where expires_at < now()");
      await query(
        `insert into patina_proposals
           (id, tenant_id, layer, subject_id, surface_id, base_seq, ops, summary, prompt, model, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)`,
        [
          p.id,
          ...keyParams(p.key),
          p.baseSeq,
          JSON.stringify(p.ops),
          p.summary,
          p.prompt,
          p.model,
          p.expiresAt,
        ],
      );
    },

    async takeProposal(id, key) {
      const { rows } = await query(
        `delete from patina_proposals
         where id = $1 and tenant_id = $2 and layer = $3 and subject_id = $4 and surface_id = $5
         returning *, expires_at > now() as live`,
        [id, ...keyParams(key)],
      );
      const r = rows[0];
      if (!r?.live) return null;
      return {
        id: r.id as string,
        key,
        baseSeq: Number(r.base_seq),
        ops: json(r.ops) as Op[],
        summary: r.summary as string,
        prompt: r.prompt as string,
        model: r.model as string,
        expiresAt: iso(r.expires_at),
      };
    },

    async incrementUsage(k) {
      const { rows } = await query(
        `insert into patina_usage (tenant_id, subject_id, period, count) values ($1, $2, $3, 1)
         on conflict (tenant_id, subject_id, period) do update set count = patina_usage.count + 1
         returning count`,
        [k.tenantId ?? "", k.subjectId, k.period],
      );
      return Number(rows[0]?.count ?? 0);
    },

    async logRequest(e) {
      await query(
        `insert into patina_requests
           (id, created_at, tenant_id, surface_id, user_id, prompt, outcome, reason, source, message,
            proposal_id, model, latency_ms, model_calls)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          e.id,
          e.at,
          e.tenantId ?? "",
          e.surfaceId,
          e.userId,
          e.prompt,
          e.outcome,
          e.reason,
          e.source,
          e.message,
          e.proposalId,
          e.model,
          e.latencyMs,
          e.modelCalls,
        ],
      );
    },

    async listRequests(f) {
      const where: string[] = [];
      const params: unknown[] = [];
      const add = (sql: string, v: unknown) => {
        params.push(v);
        where.push(sql.replace("?", `$${params.length}`));
      };
      if (f.since) add("created_at >= ?", f.since);
      if (f.until) add("created_at < ?", f.until);
      if (f.tenantId) add("tenant_id = ?", f.tenantId);
      if (f.surfaceId) add("surface_id = ?", f.surfaceId);
      if (f.outcomes?.length) add("outcome = any(?)", f.outcomes);
      params.push(Math.min(f.limit ?? 1000, 10_000));
      const { rows } = await query(
        `select * from patina_requests ${where.length ? `where ${where.join(" and ")}` : ""}
         order by created_at desc limit $${params.length}`,
        params,
      );
      return rows.map((r) => ({
        id: r.id as string,
        at: iso(r.created_at),
        surfaceId: r.surface_id as string,
        userId: r.user_id as string,
        tenantId: (r.tenant_id as string) || null,
        prompt: (r.prompt as string | null) ?? null,
        outcome: r.outcome as RequestEvent["outcome"],
        reason: (r.reason as string | null) ?? null,
        source: (r.source as RequestEvent["source"]) ?? null,
        message: (r.message as string | null) ?? null,
        proposalId: (r.proposal_id as string | null) ?? null,
        model: (r.model as string | null) ?? null,
        latencyMs:
          r.latency_ms === null || r.latency_ms === undefined ? null : Number(r.latency_ms),
        modelCalls:
          r.model_calls === null || r.model_calls === undefined ? null : Number(r.model_calls),
      }));
    },

    async redactPrompts(before) {
      await query(
        "update patina_requests set prompt = null where prompt is not null and created_at < $1",
        [before.toISOString()],
      );
      const { rows } = await query(
        "update patina_history set prompt = null where prompt is not null and created_at < $1 returning id",
        [before.toISOString()],
      );
      return rows.length;
    },
  };
}
