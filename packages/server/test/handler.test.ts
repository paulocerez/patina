import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import { toExpress } from "../src/express.js";
import {
  createPatinaHandler,
  memoryStorage,
  type ProposeResponse,
  type SurfaceState,
} from "../src/index.js";
import { scriptedModel } from "../src/testing.js";

type Ctx = { userId: string; tenantId: string; permissions: string[] };
const USERS: Record<string, Ctx> = {
  alice: { userId: "alice", tenantId: "clinic-1", permissions: ["finance.read"] },
  bob: { userId: "bob", tenantId: "clinic-1", permissions: [] },
};

const hideRevenue = {
  op: "setItem",
  node: "appointments",
  prop: "columns",
  key: "revenue",
  field: "hidden",
  value: true,
};
const statusAfterDate = {
  op: "move",
  node: "appointments",
  prop: "columns",
  key: "status",
  position: "after",
  anchor: "date",
};

/** A tiny stand-in for the model, keyed on the prompt. */
const model = scriptedModel((_req, prompt, call) => {
  if (prompt.includes("other users"))
    return { kind: "refusal", message: "I can only change how this page looks.", ops: [] };
  if (prompt.includes("delete button"))
    return {
      kind: "patch",
      message: "Added",
      ops: [
        {
          op: "insert",
          node: "kpis",
          prop: "cards",
          preset: "deleteButton",
          position: "end",
          anchor: "",
        },
      ],
    };
  if (prompt.includes("flaky"))
    return call % 2 === 1
      ? {
          kind: "patch",
          message: "x",
          ops: [{ op: "set", node: "appointments", prop: "pageSize", value: 5000 }],
        }
      : {
          kind: "patch",
          message: "Show 100 rows",
          ops: [{ op: "set", node: "appointments", prop: "pageSize", value: 100 }],
        };
  if (prompt.includes("no-shows"))
    return {
      kind: "patch",
      message: "Added",
      ops: [
        {
          op: "insert",
          node: "kpis",
          prop: "cards",
          preset: "stat.noShows",
          position: "start",
          anchor: "",
        },
      ],
    };
  if (prompt.includes("remove the no-shows")) return { kind: "patch", message: "Removed", ops: [] };
  if (prompt.includes("which"))
    return { kind: "clarify", message: "Which table do you mean?", ops: [] };
  return {
    kind: "patch",
    message: "Hid revenue and moved status after date.",
    ops: [hideRevenue, statusAfterDate],
  };
});

let storage = memoryStorage();
let handler = makeHandler();

function makeHandler() {
  return createPatinaHandler<Ctx>({
    surfaces: [dashboard],
    storage,
    model,
    basePath: "/api/patina",
    getContext: (req) => USERS[req.headers.get("x-user") ?? ""] ?? null,
    limits: { proposalsPerMinute: 0 },
  });
}

async function call<T>(
  user: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await handler(
    new Request(`http://test/api/patina/surfaces/clinic.dashboard${path}`, {
      method,
      headers: { "x-user": user, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  return { status: res.status, body: (await res.json()) as T };
}

const columns = (s: SurfaceState) =>
  ((s.spec.nodes.appointments?.props.columns ?? []) as { key: string; hidden?: boolean }[])
    .filter((c) => !c.hidden)
    .map((c) => c.key);

beforeEach(() => {
  storage = memoryStorage();
  handler = makeHandler();
  model.calls.length = 0;
});

describe("vertical slice: prompt → preview → commit → reload", () => {
  it("previews without saving, then commits and survives a reload", async () => {
    const before = await call<SurfaceState>("alice", "GET", "");
    expect(columns(before.body)).toEqual(["date", "patient", "vet", "status", "revenue"]);
    expect(before.body.canUndo).toBe(false);
    expect(before.body.render.slots.DashboardLayout).toEqual(["main"]);
    expect(before.body.render.collections.DataTable).toEqual(["columns"]);

    const p = await call<ProposeResponse>("alice", "POST", "/proposals", {
      prompt: "hide revenue and put status after date",
    });
    expect(p.status).toBe(200);
    if (p.body.kind !== "proposal") throw new Error(`expected a proposal, got ${p.body.kind}`);
    expect(p.body.changes.map((c) => c.text)).toEqual([
      "Hide “Revenue” in Appointments table",
      "Move “Status” after “Date” in Appointments table",
    ]);
    expect(columns({ spec: p.body.previewSpec } as SurfaceState)).toEqual([
      "date",
      "status",
      "patient",
      "vet",
    ]);

    // Not saved yet.
    expect(columns((await call<SurfaceState>("alice", "GET", "")).body)).toEqual([
      "date",
      "patient",
      "vet",
      "status",
      "revenue",
    ]);

    const c = await call<SurfaceState>("alice", "POST", `/proposals/${p.body.proposalId}/commit`);
    expect(c.status).toBe(200);
    expect(columns(c.body)).toEqual(["date", "status", "patient", "vet"]);

    // A fresh handler over the same storage = a reload, or another device.
    handler = makeHandler();
    const reloaded = await call<SurfaceState>("alice", "GET", "");
    expect(columns(reloaded.body)).toEqual(["date", "status", "patient", "vet"]);
    expect(reloaded.body.isCustomized).toBe(true);

    // Other users are unaffected.
    expect(columns((await call<SurfaceState>("bob", "GET", "")).body)).toEqual([
      "date",
      "patient",
      "vet",
      "status",
    ]);

    const stored = await storage.list({
      tenantId: "clinic-1",
      layer: "user",
      subjectId: "alice",
      surfaceId: "clinic.dashboard",
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      kind: "patch",
      prompt: "hide revenue and put status after date",
      model: "scripted",
    });
  });
});

describe("refusals", () => {
  it("passes on the model's refusal (\"show me other users' data\")", async () => {
    const r = await call<ProposeResponse>("alice", "POST", "/proposals", {
      prompt: "show me other users' appointments",
    });
    expect(r.body).toEqual({ kind: "refusal", message: "I can only change how this page looks." });
  });

  it('refuses with the validator\'s reason when the model proposes something not allowed ("add a delete button")', async () => {
    const r = await call<ProposeResponse>("alice", "POST", "/proposals", {
      prompt: "add a delete button",
    });
    expect(r.body).toEqual({
      kind: "refusal",
      message: "“Delete button” isn't something you can add here. You can add: No-shows card.",
    });
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]?.user).toContain("<problems_with_previous_answer>");
  });

  it("repairs once: an invalid first answer followed by a valid one becomes a proposal", async () => {
    const r = await call<ProposeResponse>("alice", "POST", "/proposals", {
      prompt: "flaky: show more rows",
    });
    expect(r.body.kind).toBe("proposal");
    expect(model.calls).toHaveLength(2);
  });

  it("passes on clarifying questions", async () => {
    const r = await call<ProposeResponse>("alice", "POST", "/proposals", { prompt: "which one?" });
    expect(r.body).toEqual({ kind: "clarify", question: "Which table do you mean?" });
  });
});

describe("safety", () => {
  it("never shows restricted columns or nodes to the user or the model", async () => {
    const s = await call<SurfaceState>("bob", "GET", "");
    expect(JSON.stringify(s.body.spec)).not.toContain("revenue");
    await call("bob", "POST", "/proposals", { prompt: "hide revenue and put status after date" });
    const view = /<current_view>[\s\S]*<\/current_view>/.exec(model.calls[0]?.user ?? "")?.[0];
    expect(view).toBeTruthy();
    expect(view).not.toContain("revenue");
    expect(JSON.stringify(model.calls[0]?.outputSchema)).not.toContain("revenue");
  });

  it("rejects requests without a session, whatever the body says", async () => {
    const res = await handler(
      new Request("http://test/api/patina/surfaces/clinic.dashboard/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "x", userId: "alice" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("commits only the caller's own, unexpired, unused proposals", async () => {
    const p = await call<ProposeResponse>("alice", "POST", "/proposals", {
      prompt: "hide revenue",
    });
    if (p.body.kind !== "proposal") throw new Error("expected proposal");
    expect((await call("bob", "POST", `/proposals/${p.body.proposalId}/commit`)).status).toBe(409);
    expect((await call("alice", "POST", "/proposals/pr_made_up/commit")).status).toBe(409);
    // Bob's attempt consumed nothing for Alice? It did not: proposals are scoped to the key.
    expect((await call("alice", "POST", `/proposals/${p.body.proposalId}/commit`)).status).toBe(
      200,
    );
    expect((await call("alice", "POST", `/proposals/${p.body.proposalId}/commit`)).status).toBe(
      409,
    );
  });

  it("re-validates at commit time and refuses a stale preview", async () => {
    const add = await call<ProposeResponse>("alice", "POST", "/proposals", {
      prompt: "add no-shows",
    });
    if (add.body.kind !== "proposal") throw new Error("expected proposal");
    await call("alice", "POST", `/proposals/${add.body.proposalId}/commit`);
    const key = add.body.ops[0]?.op === "insert" ? add.body.ops[0].key : "";

    // Preview a remove, then undo the insert before committing it.
    const rmModel = {
      kind: "patch",
      message: "Removed",
      ops: [{ op: "remove", node: "kpis", prop: "cards", key }],
    };
    model.calls.length = 0;
    const h = createPatinaHandler<Ctx>({
      surfaces: [dashboard],
      storage,
      model: { id: "x", propose: async () => rmModel },
      basePath: "/api/patina",
      getContext: (req) => USERS[req.headers.get("x-user") ?? ""] ?? null,
    });
    handler = h;
    const rm = await call<ProposeResponse>("alice", "POST", "/proposals", { prompt: "remove it" });
    if (rm.body.kind !== "proposal") throw new Error("expected proposal");
    await call("alice", "POST", "/undo");
    const c = await call<{ error: { message: string } }>(
      "alice",
      "POST",
      `/proposals/${rm.body.proposalId}/commit`,
    );
    expect(c.status).toBe(409);
    expect(c.body.error.message).toBe("Your view changed since this preview. Please ask again.");
  });
});

describe("undo and reset", () => {
  it("undoes, resets and undoes a reset", async () => {
    const commit = async (prompt: string) => {
      const p = await call<ProposeResponse>("alice", "POST", "/proposals", { prompt });
      if (p.body.kind !== "proposal") throw new Error("expected proposal");
      return (await call<SurfaceState>("alice", "POST", `/proposals/${p.body.proposalId}/commit`))
        .body;
    };
    await commit("hide revenue and put status after date");
    const custom = ["date", "status", "patient", "vet"];
    const base = ["date", "patient", "vet", "status", "revenue"];

    expect(columns((await call<SurfaceState>("alice", "POST", "/reset")).body)).toEqual(base);
    const undoneReset = (await call<SurfaceState>("alice", "POST", "/undo")).body;
    expect(columns(undoneReset)).toEqual(custom);
    const undone = (await call<SurfaceState>("alice", "POST", "/undo")).body;
    expect(columns(undone)).toEqual(base);
    expect(undone.canUndo).toBe(false);
    expect(undone.isCustomized).toBe(false);
  });
});

describe("input handling", () => {
  it("validates prompts and rate-limits", async () => {
    expect((await call("alice", "POST", "/proposals", { prompt: "  " })).status).toBe(400);
    expect((await call("alice", "POST", "/proposals", { prompt: "x".repeat(501) })).status).toBe(
      400,
    );
    handler = createPatinaHandler<Ctx>({
      surfaces: [dashboard],
      storage,
      model,
      basePath: "/api/patina",
      getContext: () => USERS.alice ?? null,
      limits: { proposalsPerMinute: 2 },
    });
    expect((await call("alice", "POST", "/proposals", { prompt: "a" })).status).toBe(200);
    expect((await call("alice", "POST", "/proposals", { prompt: "a" })).status).toBe(200);
    expect((await call("alice", "POST", "/proposals", { prompt: "a" })).status).toBe(429);
  });

  it("returns 404 for unknown surfaces and routes", async () => {
    const res = await handler(
      new Request("http://test/api/patina/surfaces/nope", { headers: { "x-user": "alice" } }),
    );
    expect(res.status).toBe(404);
    expect((await call("alice", "DELETE", "")).status).toBe(404);
  });
});

describe("toExpress", () => {
  it("serves the handler from a Node HTTP server", async () => {
    const mw = toExpress(handler);
    const server = createServer((req, res) => {
      void mw(req, res);
    });
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;
    try {
      const base = `http://127.0.0.1:${port}/api/patina/surfaces/clinic.dashboard`;
      const get = await fetch(base, { headers: { "x-user": "alice" } });
      expect(get.status).toBe(200);
      const p = await fetch(`${base}/proposals`, {
        method: "POST",
        headers: { "x-user": "alice", "content-type": "application/json" },
        body: JSON.stringify({ prompt: "hide revenue" }),
      });
      expect(((await p.json()) as ProposeResponse).kind).toBe("proposal");
    } finally {
      server.close();
    }
  });
});

describe("reset", () => {
  it("does nothing on a view that's already the default", async () => {
    const s = await call<SurfaceState>("alice", "POST", "/reset");
    expect(s.body.canUndo).toBe(false);
    expect(
      await storage.list({
        tenantId: "clinic-1",
        layer: "user",
        subjectId: "alice",
        surfaceId: "clinic.dashboard",
      }),
    ).toEqual([]);
  });
});
