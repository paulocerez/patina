import type { Op } from "@patina-ui/core";
import {
  ConflictError,
  type Entry,
  type FollowUpLinks,
  type HistoryKey,
  memoryProposals,
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

/** Which optional parts of Patina's storage you use. Everything is on by default. */
export interface PostgresFeatures {
  /**
   * Where previews (proposals) live between "preview" and "apply": "postgres" (default) or
   * "memory". Memory needs no table; with several server instances, an Apply that reaches
   * another instance than the preview gets a 409 and the user asks again.
   */
  previews?: "postgres" | "memory";
  /** The request log, for insights and follow-ups (table patina_requests). Default true. */
  requestLog?: boolean;
  /** Monthly quota counters (table patina_usage). Default true. */
  usage?: boolean;
  /** Shipped-follow-up notices (table patina_followups). Default true. */
  followUps?: boolean;
}

const TABLES = {
  history: `
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
`,
  proposals: `
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
`,
  requests: `
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
  model_calls  integer     null,
  detail       jsonb       null        -- structured refusal detail (node, wanted, …)
);
-- 0.7: tables created by earlier versions get the column when migratePostgres runs again.
alter table patina_requests add column if not exists detail jsonb null;
create index if not exists patina_requests_created_at on patina_requests (created_at);
create index if not exists patina_requests_tenant on patina_requests (tenant_id, created_at);
`,
  usage: `
create table if not exists patina_usage (
  tenant_id   text    not null default '',
  subject_id  text    not null,
  period      text    not null,
  count       integer not null default 0,
  primary key (tenant_id, subject_id, period)
);
`,
  followups: `
create table if not exists patina_followups (
  followup_key  text        not null,
  tenant_id     text        not null default '',
  user_id       text        not null,
  surface_id    text        not null,
  title         text        not null,
  linked_at     timestamptz not null default now(),
  shipped_at    timestamptz null,
  message       text        null,
  dismissed_at  timestamptz null,
  primary key (followup_key, tenant_id, user_id, surface_id)
);
create index if not exists patina_followups_user on patina_followups (tenant_id, user_id, surface_id) where shipped_at is not null and dismissed_at is null;
`,
} as const;

export type PostgresTable = keyof typeof TABLES;

/** The tables these features need: just ["history"] with every optional feature off. */
export function postgresTables(f: PostgresFeatures = {}): PostgresTable[] {
  return [
    "history",
    ...(f.previews === "memory" ? [] : ["proposals" as const]),
    ...(f.requestLog === false ? [] : ["requests" as const]),
    ...(f.usage === false ? [] : ["usage" as const]),
    ...(f.followUps === false ? [] : ["followups" as const]),
  ];
}

/** The SQL for these features. Copy it into your migrations, or run `migratePostgres`. */
export function postgresSchema(f: PostgresFeatures = {}): string {
  return postgresTables(f)
    .map((t) => TABLES[t])
    .join("\n");
}

/** The full schema (every feature). Run it with `migratePostgres(query)`, or copy it into your migrations. */
export const POSTGRES_SCHEMA = postgresSchema();

/** Creates the tables (if missing) for these features. Safe to run on every start. */
export async function migratePostgres(query: QueryFn, features?: PostgresFeatures): Promise<void> {
  for (const statement of postgresSchema(features)
    .split(";")
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

type FullPostgresStorage = StorageAdapter &
  Required<Pick<StorageAdapter, "incrementUsage" | "logRequest" | "listRequests">> &
  FollowUpLinks & {
    /** Clears stored prompts older than `before` (prompt retention). Returns the number of rows changed. */
    redactPrompts(before: Date): Promise<number>;
  };

/**
 * Postgres storage. History is append-only; `append` uses the unique
 * `(tenant_id, layer, subject_id, surface_id, seq)` constraint for optimistic concurrency.
 *
 * Pass features to use fewer tables, e.g. only saved customizations:
 *
 *   postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })
 */
export function postgresStorage(options: { query: QueryFn }): FullPostgresStorage;
export function postgresStorage(
  options: { query: QueryFn } & PostgresFeatures,
): StorageAdapter & { redactPrompts(before: Date): Promise<number> };
export function postgresStorage(
  options: { query: QueryFn } & PostgresFeatures,
): StorageAdapter & { redactPrompts(before: Date): Promise<number> } {
  const full = fullPostgresStorage(options.query, options.requestLog !== false);
  const storage: StorageAdapter & { redactPrompts(before: Date): Promise<number> } = { ...full };
  if (options.previews === "memory") Object.assign(storage, memoryProposals());
  if (options.requestLog === false) {
    delete storage.logRequest;
    delete storage.listRequests;
  }
  if (options.usage === false) delete storage.incrementUsage;
  if (options.followUps === false) {
    delete storage.linkFollowUp;
    delete storage.shipFollowUp;
    delete storage.listNotices;
    delete storage.dismissNotice;
  }
  return storage;
}

function fullPostgresStorage(query: QueryFn, requestLog: boolean): FullPostgresStorage {
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
            proposal_id, model, latency_ms, model_calls, detail)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)`,
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
          e.detail ? JSON.stringify(e.detail) : null,
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
        detail:
          r.detail === null || r.detail === undefined
            ? null
            : (json(r.detail) as RequestEvent["detail"]),
      }));
    },

    async linkFollowUp({ key, title, requesters }) {
      for (const r of requesters)
        await query(
          `insert into patina_followups (followup_key, tenant_id, user_id, surface_id, title)
           values ($1, $2, $3, $4, $5)
           on conflict (followup_key, tenant_id, user_id, surface_id) do nothing`,
          [key, r.tenantId ?? "", r.userId, r.surfaceId, title],
        );
      await query("update patina_followups set title = $2 where followup_key = $1", [key, title]);
    },
    async shipFollowUp(key, message = null) {
      const { rows } = await query(
        `update patina_followups
            set shipped_at = coalesce(shipped_at, now()), message = $2
          where followup_key = $1
         returning dismissed_at`,
        [key, message],
      );
      return rows.filter((r) => r.dismissed_at === null || r.dismissed_at === undefined).length;
    },
    async listNotices(w) {
      const { rows } = await query(
        `select followup_key, title, message, shipped_at from patina_followups
          where tenant_id = $1 and user_id = $2 and surface_id = $3
            and shipped_at is not null and dismissed_at is null
          order by shipped_at desc
          limit 20`,
        [w.tenantId ?? "", w.userId, w.surfaceId],
      );
      return rows.map((r) => ({
        key: r.followup_key as string,
        title: r.title as string,
        message: (r.message as string | null) ?? null,
        shippedAt: iso(r.shipped_at),
      }));
    },
    async dismissNotice(w, key) {
      await query(
        `update patina_followups set dismissed_at = now()
          where followup_key = $1 and tenant_id = $2 and user_id = $3 and surface_id = $4`,
        [key, w.tenantId ?? "", w.userId, w.surfaceId],
      );
    },
    async redactPrompts(before) {
      if (requestLog)
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
