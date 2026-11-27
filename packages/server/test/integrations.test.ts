import { describe, expect, it, vi } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import { createPatinaHandler, memoryStorage, type RequestEvent } from "../src/index.js";
import {
  combineEvents,
  type PostHogClientLike,
  posthogEvents,
  sentryReporter,
} from "../src/integrations.js";

function event(over: Partial<RequestEvent> = {}): RequestEvent {
  return {
    id: "rq_1",
    at: "2026-11-27T10:00:00.000Z",
    surfaceId: "dashboard",
    userId: "u1",
    tenantId: "acme",
    prompt: "add a delete button for anna@clinic.de",
    outcome: "refused",
    reason: "action",
    source: "model",
    message: "I can't delete records.",
    proposalId: null,
    model: "anthropic/claude-haiku-5-5",
    latencyMs: 812,
    modelCalls: 1,
    ...over,
  };
}

function fakeClient() {
  const calls: Parameters<PostHogClientLike["capture"]>[0][] = [];
  return { client: { capture: (m: (typeof calls)[0]) => void calls.push(m) }, calls };
}

describe("posthogEvents", () => {
  it("captures through a client, without the prompt or a person profile by default", async () => {
    const { client, calls } = fakeClient();
    await posthogEvents({ client })(event());
    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c?.distinctId).toBe("u1");
    expect(c?.event).toBe("patina request");
    expect(c?.timestamp).toEqual(new Date("2026-11-27T10:00:00.000Z"));
    expect(c?.groups).toBeUndefined();
    expect(c?.properties).toEqual({
      surface_id: "dashboard",
      outcome: "refused",
      reason: "action",
      source: "model",
      model: "anthropic/claude-haiku-5-5",
      latency_ms: 812,
      model_calls: 1,
      proposal_id: null,
      tenant_id: "acme",
      $process_person_profile: false,
    });
    expect(JSON.stringify(c)).not.toContain("anna@clinic.de");
  });

  it("adds groups, the prompt and person profiles when asked", async () => {
    const { client, calls } = fakeClient();
    await posthogEvents({
      client,
      groupType: "company",
      includePrompt: true,
      personProfiles: true,
      event: "customization",
      distinctId: (e) => `user_${e.userId}`,
    })(event());
    const c = calls[0];
    expect(c?.event).toBe("customization");
    expect(c?.distinctId).toBe("user_u1");
    expect(c?.groups).toEqual({ company: "acme" });
    expect(c?.properties).toMatchObject({
      prompt: "add a delete button for anna@clinic.de",
      $groups: { company: "acme" },
    });
    expect(c?.properties).not.toHaveProperty("$process_person_profile");
  });

  it("skips groups for events without a tenant", async () => {
    const { client, calls } = fakeClient();
    await posthogEvents({ client, groupType: "company" })(event({ tenantId: null }));
    expect(calls[0]?.groups).toBeUndefined();
    expect(calls[0]?.properties).not.toHaveProperty("$groups");
  });

  it("posts to the capture endpoint over HTTP", async () => {
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await posthogEvents({ apiKey: "phc_test", groupType: "company", fetch: fetchFn })(event());
    await posthogEvents({ apiKey: "phc_test", host: "https://us.i.posthog.com/", fetch: fetchFn })(
      event(),
    );
    expect(requests[0]?.url).toBe("https://eu.i.posthog.com/i/v0/e/");
    expect(requests[0]?.body).toMatchObject({
      api_key: "phc_test",
      event: "patina request",
      distinct_id: "u1",
      timestamp: "2026-11-27T10:00:00.000Z",
      properties: { outcome: "refused", $groups: { company: "acme" } },
    });
    expect(requests[0]?.body.properties).not.toHaveProperty("prompt");
    expect(requests[1]?.url).toBe("https://us.i.posthog.com/i/v0/e/");
  });

  it("rejects on HTTP errors, so the handler reports them to onError", async () => {
    const fetchFn = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    await expect(posthogEvents({ apiKey: "bad", fetch: fetchFn })(event())).rejects.toThrow(
      /PostHog capture failed: 401/,
    );
  });
});

describe("sentryReporter", () => {
  function fakeSentry() {
    return { captureException: vi.fn(), captureMessage: vi.fn() };
  }

  it("reports unexpected errors with a component tag", () => {
    const sentry = fakeSentry();
    const boom = new Error("boom");
    sentryReporter(sentry).onError(boom);
    expect(sentry.captureException).toHaveBeenCalledWith(boom, { tags: { component: "patina" } });
  });

  it("reports failed requests only, as warnings when the model is down", async () => {
    const sentry = fakeSentry();
    const r = sentryReporter(sentry);
    await r.onEvent(event());
    await r.onEvent(event({ outcome: "applied", reason: null }));
    expect(sentry.captureMessage).not.toHaveBeenCalled();

    await r.onEvent(event({ outcome: "error", reason: "model_unavailable" }));
    await r.onEvent(event({ outcome: "error", reason: "internal", model: null }));
    expect(sentry.captureMessage).toHaveBeenNthCalledWith(1, "Patina: model_unavailable", {
      level: "warning",
      tags: {
        component: "patina",
        surface: "dashboard",
        reason: "model_unavailable",
        model: "anthropic/claude-haiku-5-5",
      },
      extra: { requestId: "rq_1", latencyMs: 812 },
    });
    const second = sentry.captureMessage.mock.calls[1];
    expect(second?.[0]).toBe("Patina: internal");
    expect(second?.[1]).toMatchObject({ level: "error", tags: { reason: "internal" } });
    expect(second?.[1].tags).not.toHaveProperty("model");
    const sent = JSON.stringify(sentry.captureMessage.mock.calls);
    expect(sent).not.toContain("anna@clinic.de");
    expect(sent).not.toContain("u1");
  });

  it("attaches the user id only when asked", async () => {
    const sentry = fakeSentry();
    await sentryReporter(sentry, { includeUser: true }).onEvent(
      event({ outcome: "error", reason: "internal" }),
    );
    expect(sentry.captureMessage.mock.calls[0]?.[1]).toMatchObject({ user: { id: "u1" } });
  });
});

describe("combineEvents", () => {
  it("runs every handler and aggregates failures", async () => {
    const seen: string[] = [];
    const combined = combineEvents(
      (e) => void seen.push(`a:${e.id}`),
      undefined,
      async () => {
        throw new Error("posthog down");
      },
      null,
      async (e) => void seen.push(`b:${e.id}`),
    );
    const err = await Promise.resolve(combined(event())).catch((e: unknown) => e);
    expect(seen).toEqual(["a:rq_1", "b:rq_1"]);
    expect(err).toBeInstanceOf(AggregateError);
    expect((err as AggregateError).errors.map((x: Error) => x.message)).toEqual(["posthog down"]);
    expect((err as AggregateError).message).toBe("1 of 3 event handlers failed");
  });

  it("resolves when all succeed, including a synchronous throw turned into a rejection", async () => {
    await expect(combineEvents(() => {})(event())).resolves.toBeUndefined();
    await expect(
      combineEvents(() => {
        throw new Error("sync");
      })(event()),
    ).rejects.toBeInstanceOf(AggregateError);
  });
});

describe("wired into createPatinaHandler", () => {
  type Ctx = { userId: string; tenantId: string; permissions: string[] };
  const model = {
    id: "test-model",
    async propose() {
      return { kind: "refusal", message: "I can't delete records.", category: "action", ops: [] };
    },
  };

  it("sends a refused request to PostHog and reports a failing sink to onError", async () => {
    const { client, calls } = fakeClient();
    const sentry = { captureException: vi.fn(), captureMessage: vi.fn() };
    const reporter = sentryReporter(sentry);
    const handler = createPatinaHandler<Ctx>({
      surfaces: [dataSurface],
      storage: memoryStorage(),
      model,
      getContext: () => ({ userId: "ann", tenantId: "acme", permissions: [] }),
      onEvent: combineEvents(
        posthogEvents({ client, groupType: "company" }),
        reporter.onEvent,
        () => {
          throw new Error("broken sink");
        },
      ),
      onError: reporter.onError,
    });
    const res = await handler(
      new Request("http://x/surfaces/data/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "add a delete button" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "refusal" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      distinctId: "ann",
      event: "patina request",
      groups: { company: "acme" },
      properties: { surface_id: "data", outcome: "refused", reason: "action", source: "model" },
    });
    expect(calls[0]?.properties).not.toHaveProperty("prompt");
    // The broken handler doesn't affect the user; it reaches onError (here: Sentry).
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException.mock.calls[0]?.[0]).toBeInstanceOf(AggregateError);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });
});
