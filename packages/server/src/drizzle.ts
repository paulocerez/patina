/**
 * Patina's tables as Drizzle definitions, for apps that manage their schema with Drizzle.
 * Re-export the ones you use from your schema file and `drizzle-kit generate` writes the
 * migration:
 *
 *   // db/schema.ts
 *   export { patinaHistory } from "@patina-ui/server/drizzle";
 *
 * They match `postgresSchema()` column for column, including the constraint names Postgres
 * gives that SQL, so a database created either way shows no drift. Which tables you need
 * depends on the features you use (`postgresTables`): with
 * `postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })`
 * only `patinaHistory`.
 * @packageDocumentation
 * @module @patina-ui/server/drizzle
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const createdNow = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" }).defaultNow().notNull();

/** Saved customizations (always needed). */
export const patinaHistory = pgTable(
  "patina_history",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").default("").notNull(),
    layer: text("layer").notNull(),
    subjectId: text("subject_id").notNull(),
    surfaceId: text("surface_id").notNull(),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(),
    targetId: text("target_id"),
    schemaVersion: integer("schema_version"),
    baseVersion: integer("base_version"),
    ops: jsonb("ops"),
    prompt: text("prompt"),
    summary: text("summary"),
    model: text("model"),
    createdAt: createdNow("created_at"),
  },
  (t) => [
    unique("patina_history_tenant_id_layer_subject_id_surface_id_seq_key").on(
      t.tenantId,
      t.layer,
      t.subjectId,
      t.surfaceId,
      t.seq,
    ),
    foreignKey({
      name: "patina_history_target_id_fkey",
      columns: [t.targetId],
      foreignColumns: [t.id as AnyPgColumn],
    }),
    check("patina_history_layer_check", sql`${t.layer} in ('user', 'tenant')`),
    check("patina_history_kind_check", sql`${t.kind} in ('patch', 'revert', 'reset')`),
  ],
);

/** Previews between "preview" and "apply" (not needed with `previews: "memory"`). */
export const patinaProposals = pgTable(
  "patina_proposals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").default("").notNull(),
    layer: text("layer").notNull(),
    subjectId: text("subject_id").notNull(),
    surfaceId: text("surface_id").notNull(),
    baseSeq: integer("base_seq").notNull(),
    ops: jsonb("ops").notNull(),
    summary: text("summary").notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [index("patina_proposals_expires_at").on(t.expiresAt)],
);

/** The request log, for insights and follow-ups (not needed with `requestLog: false`). */
export const patinaRequests = pgTable(
  "patina_requests",
  {
    id: text("id").primaryKey(),
    createdAt: createdNow("created_at"),
    tenantId: text("tenant_id").default("").notNull(),
    surfaceId: text("surface_id").notNull(),
    userId: text("user_id").notNull(),
    prompt: text("prompt"),
    outcome: text("outcome").notNull(),
    reason: text("reason"),
    source: text("source"),
    message: text("message"),
    proposalId: text("proposal_id"),
    model: text("model"),
    latencyMs: integer("latency_ms"),
    modelCalls: integer("model_calls"),
    detail: jsonb("detail"),
  },
  (t) => [
    index("patina_requests_created_at").on(t.createdAt),
    index("patina_requests_tenant").on(t.tenantId, t.createdAt),
  ],
);

/** Monthly quota counters (not needed with `usage: false`). */
export const patinaUsage = pgTable(
  "patina_usage",
  {
    tenantId: text("tenant_id").default("").notNull(),
    subjectId: text("subject_id").notNull(),
    period: text("period").notNull(),
    count: integer("count").default(0).notNull(),
  },
  (t) => [primaryKey({ name: "patina_usage_pkey", columns: [t.tenantId, t.subjectId, t.period] })],
);

/** Who asked for which follow-up, for shipped notices (not needed with `followUps: false`). */
export const patinaFollowups = pgTable(
  "patina_followups",
  {
    followupKey: text("followup_key").notNull(),
    tenantId: text("tenant_id").default("").notNull(),
    userId: text("user_id").notNull(),
    surfaceId: text("surface_id").notNull(),
    title: text("title").notNull(),
    linkedAt: createdNow("linked_at"),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "date" }),
    message: text("message"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    primaryKey({
      name: "patina_followups_pkey",
      columns: [t.followupKey, t.tenantId, t.userId, t.surfaceId],
    }),
    index("patina_followups_user")
      .on(t.tenantId, t.userId, t.surfaceId)
      .where(sql`${t.shippedAt} is not null and ${t.dismissedAt} is null`),
  ],
);
