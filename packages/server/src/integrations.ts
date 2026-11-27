/**
 * Event integrations: forward Patina's request events to PostHog and its errors to Sentry.
 * Plug the results into `createPatinaHandler({ onEvent, onError })`. No SDK dependencies:
 * pass your own PostHog or Sentry client, or use PostHog's HTTP API.
 * @packageDocumentation
 * @module @patina-ui/server/integrations
 */
import type { RequestEvent } from "./storage.js";

export type EventHandler = (event: RequestEvent) => void | Promise<void>;

/** The part of posthog-node's client Patina uses. */
export interface PostHogClientLike {
  capture(message: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
    groups?: Record<string, string>;
    timestamp?: Date;
  }): unknown;
}

interface PostHogCommon {
  /** Event name. Default "patina request". */
  event?: string;
  /** Who the event is about. Default the Patina user id (`ctx.userId`). */
  distinctId?(event: RequestEvent): string;
  /** PostHog group type for the tenant (e.g. "company"), so events roll up per customer. */
  groupType?: string;
  /** Send the user's words as `prompt`. Default false: prompts are free text users typed. */
  includePrompt?: boolean;
  /** Let PostHog create or update person profiles. Default false (anonymous-style events). */
  personProfiles?: boolean;
}

export type PostHogEventsOptions = PostHogCommon &
  (
    | { client: PostHogClientLike; apiKey?: never; host?: never; fetch?: never }
    | {
        client?: never;
        /** Project API key (phc_…). */
        apiKey: string;
        /** Default https://eu.i.posthog.com. US cloud: https://us.i.posthog.com. */
        host?: string;
        fetch?: typeof fetch;
      }
  );

/** The properties sent for one request event. */
export function posthogProperties(
  e: RequestEvent,
  options: Pick<PostHogCommon, "includePrompt" | "personProfiles" | "groupType"> = {},
): Record<string, unknown> {
  return {
    surface_id: e.surfaceId,
    outcome: e.outcome,
    reason: e.reason,
    source: e.source,
    model: e.model,
    latency_ms: e.latencyMs,
    model_calls: e.modelCalls,
    proposal_id: e.proposalId,
    tenant_id: e.tenantId,
    ...(options.includePrompt ? { prompt: e.prompt } : {}),
    ...(options.personProfiles ? {} : { $process_person_profile: false }),
    ...(options.groupType && e.tenantId ? { $groups: { [options.groupType]: e.tenantId } } : {}),
  };
}

/**
 * An `onEvent` that sends every customization request to PostHog: outcome, reason, surface,
 * model and latency. Prompts are not sent unless `includePrompt` is set.
 *
 *   onEvent: posthogEvents({ client: posthog, groupType: "company" })
 */
export function posthogEvents(options: PostHogEventsOptions): EventHandler {
  const event = options.event ?? "patina request";
  const distinctId = options.distinctId ?? ((e: RequestEvent) => e.userId);

  if (options.client) {
    const client = options.client;
    return async (e) => {
      const groups =
        options.groupType && e.tenantId ? { [options.groupType]: e.tenantId } : undefined;
      await client.capture({
        distinctId: distinctId(e),
        event,
        properties: posthogProperties(e, options),
        ...(groups ? { groups } : {}),
        timestamp: new Date(e.at),
      });
    };
  }

  const host = (options.host ?? "https://eu.i.posthog.com").replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  return async (e) => {
    const res = await doFetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: options.apiKey,
        event,
        distinct_id: distinctId(e),
        properties: posthogProperties(e, options),
        timestamp: e.at,
      }),
    });
    if (!res.ok) throw new Error(`PostHog capture failed: ${res.status}`);
  };
}

/** The part of the Sentry SDK (`@sentry/node`, `@sentry/bun`, …) Patina uses. */
export interface SentryLike {
  captureException(error: unknown, context?: Record<string, unknown>): unknown;
  captureMessage(message: string, context?: Record<string, unknown>): unknown;
}

export interface SentryReporterOptions {
  /** Attach the Patina user id as Sentry's `user.id`. Default false. */
  includeUser?: boolean;
}

/**
 * Reports unexpected errors (`onError`) and failed requests (`onEvent`, outcome "error": the
 * model was unreachable or something broke) to Sentry. Prompts are never sent.
 *
 *   const sentry = sentryReporter(Sentry);
 *   createPatinaHandler({ onError: sentry.onError, onEvent: sentry.onEvent, … })
 */
export function sentryReporter(
  sentry: SentryLike,
  options: SentryReporterOptions = {},
): { onError(error: unknown): void; onEvent: EventHandler } {
  return {
    onError(error) {
      sentry.captureException(error, { tags: { component: "patina" } });
    },
    onEvent(e) {
      if (e.outcome !== "error") return;
      sentry.captureMessage(`Patina: ${e.reason ?? "error"}`, {
        level: e.reason === "model_unavailable" ? "warning" : "error",
        tags: {
          component: "patina",
          surface: e.surfaceId,
          reason: e.reason ?? "unknown",
          ...(e.model ? { model: e.model } : {}),
        },
        extra: { requestId: e.id, latencyMs: e.latencyMs },
        ...(options.includeUser ? { user: { id: e.userId } } : {}),
      });
    },
  };
}

/**
 * One `onEvent` from several. Each runs even if another fails; failures are rethrown together
 * as an AggregateError, which the handler passes to `onError`.
 */
export function combineEvents(...handlers: (EventHandler | null | undefined)[]): EventHandler {
  const list = handlers.filter((h): h is EventHandler => typeof h === "function");
  return async (event) => {
    const results = await Promise.allSettled(list.map(async (h) => h(event)));
    const errors = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    if (errors.length)
      throw new AggregateError(errors, `${errors.length} of ${list.length} event handlers failed`);
  };
}
