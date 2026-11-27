/**
 * Request handler and storage adapters.
 * @packageDocumentation
 * @module @patina-ui/server
 */
export type { ErrorBody, ProposeResponse, SurfaceState } from "@patina-ui/core";
export type { AvailabilityRule, PatinaContext, PatinaHandlerOptions } from "./handler.js";
export { createPatinaHandler } from "./handler.js";
export type { InsightsReport, ReasonCount, UnmetRequest } from "./insights.js";
export {
  getInsights,
  normalizePrompt,
  parseSince,
  REASON_LABELS,
  renderInsightsMarkdown,
  summarizeRequests,
} from "./insights.js";
export type { ModelAdapter } from "./model.js";
export { ModelRefusal, withBackup } from "./model.js";
export type { QueryFn } from "./postgres.js";
export { migratePostgres, POSTGRES_SCHEMA, postgresStorage } from "./postgres.js";
export type {
  Entry,
  HistoryKey,
  NewEntry,
  Proposal,
  RequestEvent,
  RequestFilter,
  RequestOutcome,
  StorageAdapter,
  UsageKey,
} from "./storage.js";
export { ConflictError, memoryStorage } from "./storage.js";
