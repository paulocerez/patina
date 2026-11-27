import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import {
  type AvailabilityRule,
  createPatinaHandler,
  ModelRefusal,
  memoryStorage,
  normalizePrompt,
  type ProposeResponse,
  type RequestEvent,
  renderInsightsMarkdown,
  summarizeRequests,
} from "../src/index.js";

type Ctx = { userId: string; tenantId: string; permissions: string[]; staff?: boolean };
const users: Record<string, Ctx> = {
  ann: { userId: "ann", tenantId: "acme", permissions: [] },
  ben: { userId: "ben", tenantId: "globex", permissions: [] },
  sam: { userId: "sam", tenantId: "patina-host", permissions: [], staff: true },
};

const hideVet = {
  op: "setItem",
  node: "table",
  prop: "columns",
  key: "vet",
  field: "hidden",
  value: true,
};
const model = {
  id: "test-model",
  async propose(req: { user: string }) {
    const prompt = /<request>\n([\s\S]*?)\n<\/request>/.exec(req.user)?.[1] ?? "";
    if (prompt.includes("delete"))
      return { kind: "refusal", message: "I can't delete records.", category: "action", ops: [] };
    if (prompt.includes("unsafe")) throw new ModelRefusal("I can't help with that.");
    if (prompt.includes("down")) throw new Error("ECONNRESET");
    if (prompt.includes("which")) return { kind: "clarify", message: "Which table?", ops: [] };
    if (prompt.includes("widget"))
      return {
        kind: "patch",
        message: "",
        ops: [
          {
            op: "insert",
            node: "page",
            prop: "main",
            preset: "weather",
            position: "end",
            anchor: "",
          },
        ],
      };
    return { kind: "patch", message: "Hid vet", ops: [hideVet] };
  },
};

let storage = memoryStorage();
let rule: AvailabilityRule = {};
let events: RequestEvent[] = [];
let onEvent = (e: RequestEvent) => void events.push(e);
const onError = vi.fn();

const handler = () =>
  createPatinaHandler<Ctx>({
    surfaces: [dataSurface],
    storage,
    model,
    getContext: (req) => users[req.headers.get("x-user") ?? ""] ?? null,
    availability: () => rule,
    onEvent: (e) => onEvent(e),
    onError,
    insights: { allow: (ctx) => ctx.staff === true },
    limits: {
      proposalsPerMinute: 0,
      monthlyProposals: (ctx) => (ctx.userId === "ben" ? { user: 1 } : undefined),
    },
  });

async function ask(prompt: string, user = "ann") {
  const h = handler();
  const res = await h(
    new Request("http://x/surfaces/data/proposals", {
      method: "POST",
      headers: { "x-user": user, "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    }),
  );
  const body = (await res.json()) as ProposeResponse;
  if (body.kind === "proposal")
    await h(
      new Request(`http://x/surfaces/data/proposals/${body.proposalId}/commit`, {
        method: "POST",
        headers: { "x-user": user },
      }),
    );
  return res.status;
}

beforeEach(() => {
  storage = memoryStorage();
  rule = {};
  events = [];
  onEvent = (e) => void events.push(e);
  onError.mockReset();
});

describe("request log", () => {
  it("records every outcome with who decided and why, including the prompt", async () => {
    await ask("hide the vet column");
    await ask("Please delete all appointments!");
    await ask("which one?");
    await ask("add a weather widget");
    await ask("unsafe thing");
    await ask("the model is down");
    await ask("hide vet", "ben");
    await ask("hide vet again", "ben"); // over ben's quota of 1
    rule = { customize: false, message: "Upgrade to customize." };
    await ask("hide vet");

    const log = (await storage.listRequests?.({})) ?? [];
    // onEvent sees exactly what was stored, in the order it happened.
    expect(new Set(log.map((e) => JSON.stringify(e)))).toEqual(
      new Set(events.map((e) => JSON.stringify(e))),
    );
    const rows = events.map((e) => [e.prompt, e.outcome, e.source, e.reason, e.modelCalls]);
    expect(rows).toEqual([
      ["hide the vet column", "proposed", null, null, 1],
      ["hide the vet column", "applied", null, null, null],
      ["Please delete all appointments!", "refused", "model", "action", 1],
      ["which one?", "clarified", "model", null, 1],
      ["add a weather widget", "refused", "validator", "preset_not_allowed", 2],
      ["unsafe thing", "refused", "model", "safety", 1],
      ["the model is down", "error", null, "model_unavailable", null],
      ["hide vet", "proposed", null, null, 1],
      ["hide vet", "applied", null, null, null],
      ["hide vet again", "over_quota", "host", "quota_user", null],
      ["hide vet", "unavailable", "host", "customize_off", null],
    ]);
    expect(log.find((e) => e.outcome === "unavailable")?.message).toBe("Upgrade to customize.");
    expect(log.find((e) => e.reason === "action")).toMatchObject({
      userId: "ann",
      tenantId: "acme",
      surfaceId: "data",
      model: "test-model",
    });
    expect(log.find((e) => e.outcome === "applied")?.proposalId).toMatch(/^pr_/);
  });

  it("onEvent failures never reach the user", async () => {
    onEvent = () => {
      throw new Error("analytics down");
    };
    expect(await ask("hide vet")).toBe(200);
    expect(onError).toHaveBeenCalled();
    expect((await storage.listRequests?.({}))?.length).toBe(2);
  });

  it("prompt retention clears logged prompts too", async () => {
    await ask("hide vet");
    await storage.redactPrompts(new Date(Date.now() + 1000));
    expect((await storage.listRequests?.({}))?.every((e) => e.prompt === null)).toBe(true);
  });
});

describe("insights", () => {
  const ev = (
    prompt: string,
    outcome: RequestEvent["outcome"],
    tenantId: string,
    reason: string | null = null,
    userId = "u",
  ): RequestEvent => ({
    id: Math.random().toString(36),
    at: "2026-11-20T10:00:00.000Z",
    surfaceId: "data",
    userId,
    tenantId,
    prompt,
    outcome,
    reason,
    source: reason ? "model" : null,
    message: null,
    proposalId: null,
    model: null,
    latencyMs: 100,
    modelCalls: 1,
  });

  it("groups the same request worded differently and ranks by how many customers ask", () => {
    expect(normalizePrompt("Please, add a DELETE button!")).toBe("add a delete button");
    expect(normalizePrompt("can you add a delete button please")).toBe("add a delete button");
    const r = summarizeRequests([
      ev("Please add a delete button!", "refused", "acme", "action"),
      ev("add a delete button", "refused", "globex", "action"),
      ev("add a delete button", "refused", "initech", "action"),
      ev("make it pink", "refused", "acme", "styling"),
      ev("make it pink", "refused", "acme", "styling"),
      ev("make it pink", "refused", "acme", "styling"),
      ev("make it pink", "refused", "acme", "styling"),
      ev("hide vet", "proposed", "acme"),
      ev("hide vet", "applied", "acme"),
    ]);
    expect(r.requests).toBe(8);
    expect(r.appliedRate).toBe(1 / 8);
    expect(r.unmetRate).toBe(7 / 8);
    expect(r.unmet.map((u) => [u.prompt, u.count, u.tenants])).toEqual([
      ["add a delete button", 3, 3], // 3 customers beat 4 requests from one
      ["make it pink", 4, 1],
    ]);
    expect(r.reasons.map((x) => [x.reason, x.count])).toEqual([
      ["styling", 4],
      ["action", 3],
    ]);
    const md = renderInsightsMarkdown(r);
    expect(md).toContain("| add a delete button | 3 | 3 | 3 | action |");
    expect(md).toContain("All time: **8 requests** from 3 users in 3 organizations.");
    expect(md).toContain("Wanted to do something to data");
  });

  it("serves the report only to allowed users", async () => {
    await ask("Please delete all appointments!");
    await ask("delete everything", "ben");
    const get = (user: string, qs = "") =>
      handler()(new Request(`http://x/insights${qs}`, { headers: { "x-user": user } }));
    expect((await get("ann")).status).toBe(403);
    const r = await get("sam");
    expect(r.status).toBe(200);
    const report = (await r.json()) as {
      requests: number;
      unmet: { prompt: string; tenants: number }[];
    };
    expect(report.requests).toBe(2);
    expect(report.unmet[0]?.tenants).toBe(1);
    const md = await (await get("sam", "?format=markdown&tenant=acme")).text();
    expect(md).toContain("**1 requests**");
    expect(md).toContain("Please delete all appointments!");
  });
});
