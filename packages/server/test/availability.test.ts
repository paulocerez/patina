import type { ProposeResponse, SurfaceState } from "@patina-ui/core";
import { beforeEach, describe, expect, it } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import {
  type AvailabilityRule,
  createPatinaHandler,
  memoryStorage,
  type StorageAdapter,
} from "../src/index.js";
import { scriptedModel } from "../src/testing.js";

type Ctx = { userId: string; tenantId: string; permissions: string[]; plan: string };
const users: Record<string, Ctx> = {
  ann: { userId: "ann", tenantId: "acme", permissions: ["finance.read"], plan: "pro" },
  ben: { userId: "ben", tenantId: "acme", permissions: ["finance.read"], plan: "pro" },
};

const hideVet = {
  op: "setItem",
  node: "table",
  prop: "columns",
  key: "vet",
  field: "hidden",
  value: true,
};
const addChart = {
  op: "insert",
  node: "page",
  prop: "main",
  preset: "block.chart",
  position: "end",
  anchor: "",
  props: {
    kind: "bar",
    query: {
      source: "appointments",
      groupBy: { field: "vet", bucket: null },
      metric: { op: "count", field: null },
      where: null,
    },
  },
};
const model = scriptedModel((_r, prompt) => ({
  kind: "patch",
  message: "",
  ops: [prompt.includes("chart") ? addChart : hideVet],
}));

let rule: AvailabilityRule = {};
let storage = memoryStorage();
let quota: { user?: number; tenant?: number } | undefined;
const seen: [string, string][] = [];

function handler(s: StorageAdapter = storage) {
  return createPatinaHandler<Ctx>({
    surfaces: [dataSurface],
    storage: s,
    model,
    getContext: (req) => users[req.headers.get("x-user") ?? ""] ?? null,
    availability: async (ctx, surfaceId) => {
      seen.push([ctx.userId, surfaceId]);
      return rule;
    },
    limits: { proposalsPerMinute: 0, monthlyProposals: () => quota },
  });
}

async function call<T>(method: string, path = "", body?: unknown, user = "ann") {
  const res = await handler()(
    new Request(`http://x/surfaces/data${path}`, {
      method,
      headers: { "x-user": user, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  return { status: res.status, body: (await res.json()) as T };
}

async function customize(prompt: string, user = "ann") {
  const p = await call<ProposeResponse>("POST", "/proposals", { prompt }, user);
  if (p.body.kind !== "proposal") throw new Error(`expected a proposal: ${JSON.stringify(p.body)}`);
  return (
    await call<SurfaceState>("POST", `/proposals/${p.body.proposalId}/commit`, undefined, user)
  ).body;
}

const vetHidden = (s: SurfaceState) =>
  ((s.spec.nodes.table?.props.columns ?? []) as { key: string; hidden?: boolean }[]).find(
    (c) => c.key === "vet",
  )?.hidden === true;
const chartNodes = (s: SurfaceState) =>
  Object.values(s.spec.nodes).filter((n) => n.preset === "block.chart").length;

beforeEach(() => {
  rule = {};
  quota = undefined;
  storage = memoryStorage();
  model.calls.length = 0;
});

describe("customize off", () => {
  it("keep (default): the view keeps the user's changes, but nothing can be changed", async () => {
    await customize("hide vet");
    rule = { customize: false };
    const s = (await call<SurfaceState>("GET")).body;
    expect(vetHidden(s)).toBe(true);
    expect(s.availability).toEqual({
      customize: false,
      dataViews: false,
      message: "Customizing this view isn't available on your account.",
    });
    expect(s.canUndo).toBe(false);
    for (const path of ["/proposals", "/undo", "/reset", "/proposals/pr_x/commit"]) {
      const r = await call<{ error: { message: string } }>("POST", path, { prompt: "x" });
      expect(r.status, path).toBe(403);
    }
    expect(model.calls).toHaveLength(1); // only the call from before access was turned off
  });

  it("base: the default view, and the user's changes come back with access", async () => {
    await customize("hide vet");
    rule = { customize: false, whenOff: "base", message: "Upgrade to Pro to customize." };
    const off = (await call<SurfaceState>("GET")).body;
    expect(vetHidden(off)).toBe(false);
    expect(off.availability.message).toBe("Upgrade to Pro to customize.");
    expect(
      (await call<{ error: { message: string } }>("POST", "/proposals", { prompt: "x" })).body.error
        .message,
    ).toBe("Upgrade to Pro to customize.");
    rule = {};
    expect(vetHidden((await call<SurfaceState>("GET")).body)).toBe(true);
  });

  it("asks the hook per user and surface", async () => {
    await call("GET", "", undefined, "ben");
    expect(seen.at(-1)).toEqual(["ben", "data"]);
  });
});

describe("data views off", () => {
  it("keep: saved data views stay, but new ones aren't offered or allowed; other edits still work", async () => {
    await customize("add a chart");
    rule = { dataViews: false };
    const s = (await call<SurfaceState>("GET")).body;
    expect(chartNodes(s)).toBe(1);
    expect(s.availability).toMatchObject({ customize: true, dataViews: false });
    expect(s.catalog?.sources.appointments).toBeDefined(); // existing blocks can still load data

    const r = await call<ProposeResponse>("POST", "/proposals", { prompt: "another chart" });
    expect(r.body).toEqual({
      kind: "refusal",
      message: "Creating new charts, tables and cards isn't available on your account.",
    });
    const request = model.calls.at(-1);
    expect(request?.user).not.toContain("<data_sources>");
    expect(JSON.stringify(request?.outputSchema)).not.toContain("block.chart");

    expect(vetHidden(await customize("hide vet"))).toBe(true);
  });

  it("base: saved data views are hidden too", async () => {
    await customize("add a chart");
    rule = { dataViews: false, whenOff: "base" };
    expect(chartNodes((await call<SurfaceState>("GET")).body)).toBe(0);
    rule = {};
    expect(chartNodes((await call<SurfaceState>("GET")).body)).toBe(1);
  });
});

describe("monthly quotas", () => {
  it("limits requests per user and per tenant", async () => {
    quota = { user: 2 };
    expect((await call("POST", "/proposals", { prompt: "a" })).status).toBe(200);
    expect((await call("POST", "/proposals", { prompt: "a" })).status).toBe(200);
    const third = await call<{ error: { message: string } }>("POST", "/proposals", { prompt: "a" });
    expect(third.status).toBe(429);
    expect(third.body.error.message).toBe(
      "You've used all 2 customization requests for this month.",
    );
    expect(model.calls).toHaveLength(2); // the model isn't called past the quota

    storage = memoryStorage();
    quota = { tenant: 3 };
    for (const u of ["ann", "ben", "ann"])
      expect((await call("POST", "/proposals", { prompt: "a" }, u)).status).toBe(200);
    expect((await call("POST", "/proposals", { prompt: "a" }, "ben")).status).toBe(429);
  });

  it("needs a storage adapter that can count", () => {
    const { incrementUsage: _omit, ...noCounter } = memoryStorage();
    expect(() => handler(noCounter as StorageAdapter)).toThrow(/incrementUsage/);
  });
});
