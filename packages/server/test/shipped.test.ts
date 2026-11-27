import { createHmac } from "node:crypto";
import type { SurfaceState } from "@patina-ui/core";
import { beforeEach, describe, expect, it } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import {
  type FollowUpSink,
  followUpWebhook,
  runFollowUps,
  shipFollowUp,
} from "../src/followups.js";
import { createPatinaHandler, memoryStorage } from "../src/index.js";

type Ctx = { userId: string; tenantId: string; permissions: string[] };
const users: Record<string, Ctx> = {
  ann: { userId: "ann", tenantId: "acme", permissions: [] },
  ben: { userId: "ben", tenantId: "globex", permissions: [] },
  cat: { userId: "cat", tenantId: "acme", permissions: [] },
};
const model = {
  id: "test-model",
  async propose() {
    return { kind: "refusal", message: "No maps here.", category: "new_component", ops: [] };
  },
};

let storage = memoryStorage();
const handler = () =>
  createPatinaHandler<Ctx>({
    surfaces: [dataSurface],
    storage,
    model,
    getContext: (req) => users[req.headers.get("x-user") ?? ""] ?? null,
    limits: { proposalsPerMinute: 0 },
  });

async function ask(user: string, prompt = "add a map") {
  await handler()(
    new Request("http://x/surfaces/data/proposals", {
      method: "POST",
      headers: { "x-user": user, "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    }),
  );
}
async function view(user: string, locale = "de") {
  const res = await handler()(
    new Request("http://x/surfaces/data", {
      headers: { "x-user": user, "x-patina-locale": locale },
    }),
  );
  return (await res.json()) as SurfaceState;
}

const sign = (secret: string, body: string) =>
  createHmac("sha256", secret).update(body).digest("hex");

const ticketSink: FollowUpSink = {
  name: "tracker",
  deliver: async (items) => items.map((f) => ({ sink: "tracker", key: f.key, action: "created" })),
};

beforeEach(() => {
  storage = memoryStorage();
});

describe("shipped follow-ups", () => {
  it("tells exactly the users who asked, on the page where they asked, until dismissed", async () => {
    await ask("ann");
    await ask("ben", "Add a map!");
    await ask("cat", "add a delete button");
    const run = await runFollowUps({ storage, sinks: [ticketSink] });
    expect(run.followUps.map((f) => f.title)).toEqual(["Add a map"]);
    const key = run.followUps[0]?.key as string;

    expect((await view("ann")).notices).toBeUndefined();

    const body = JSON.stringify({
      type: "Issue",
      action: "update",
      webhookTimestamp: Date.now(),
      data: {
        title: "Customer request: Add a map",
        description: `…\n<sub>patina-followup:${key}</sub>`,
        state: { type: "completed" },
        url: "https://linear.app/x/issue/ENG-1",
      },
    });
    const shipped: unknown[] = [];
    const hook = followUpWebhook({
      provider: "linear",
      secret: "s3cret",
      storage,
      onShipped: (s) => void shipped.push(s),
    });
    const res = await hook(
      new Request("http://x/hooks/linear", {
        method: "POST",
        headers: { "linear-signature": sign("s3cret", body) },
        body,
      }),
    );
    expect(await res.json()).toEqual({ shipped: key, notices: 2 });
    expect(shipped).toEqual([{ key, notices: 2 }]);

    const ann = await view("ann");
    expect(ann.notices).toEqual([
      { key, title: "Add a map", message: null, shippedAt: expect.any(String) },
    ]);
    expect((await view("ben")).notices).toHaveLength(1);
    expect((await view("cat")).notices).toBeUndefined();

    const dismissed = await handler()(
      new Request(`http://x/surfaces/data/notices/${key}/dismiss`, {
        method: "POST",
        headers: { "x-user": "ann" },
      }),
    );
    expect(dismissed.status).toBe(200);
    expect((await view("ann")).notices).toBeUndefined();
    expect((await view("ben")).notices).toHaveLength(1);
  });

  it("doesn't link anything on dry runs or when no sink delivered", async () => {
    await ask("ann");
    await ask("ann");
    const dry = await runFollowUps({ storage, sinks: [ticketSink], dryRun: true });
    const key = dry.followUps[0]?.key as string;
    expect(await shipFollowUp(storage, key)).toBe(0);
    const skipping: FollowUpSink = {
      name: "s",
      deliver: async (items) => items.map((f) => ({ sink: "s", key: f.key, action: "skipped" })),
    };
    await runFollowUps({ storage, sinks: [skipping] });
    expect(await shipFollowUp(storage, key)).toBe(0);
    await runFollowUps({ storage, sinks: [ticketSink] });
    expect(await shipFollowUp(storage, key, "Neu: Karten unter Statistik")).toBe(1);
    expect((await view("ann")).notices?.[0]?.message).toBe("Neu: Karten unter Statistik");
  });
});

describe("followUpWebhook", () => {
  const key = "pf-0123456789";
  async function seed() {
    await storage.linkFollowUp({
      key,
      title: "Add a map",
      requesters: [{ tenantId: "acme", userId: "ann", surfaceId: "data" }],
    });
  }
  const post = (hook: (r: Request) => Promise<Response>, body: string, headers: HeadersInit) =>
    hook(new Request("http://x/hook", { method: "POST", headers, body }));

  it("rejects bad signatures and stale Linear deliveries", async () => {
    await seed();
    const hook = followUpWebhook({ provider: "linear", secret: "s", storage, now: () => 1e12 });
    const body = JSON.stringify({
      type: "Issue",
      webhookTimestamp: 1e12 - 10 * 60_000,
      data: { title: "t", description: `patina-followup:${key}`, state: { type: "completed" } },
    });
    expect((await post(hook, body, { "linear-signature": "00" })).status).toBe(401);
    expect((await post(hook, body, {})).status).toBe(401);
    expect((await post(hook, body, { "linear-signature": sign("s", body) })).status).toBe(401);
    expect(
      await storage.listNotices({ tenantId: "acme", userId: "ann", surfaceId: "data" }),
    ).toEqual([]);
  });

  it("GitHub: ships on closed as completed, ignores not planned", async () => {
    await seed();
    const hook = followUpWebhook({
      provider: "github",
      secret: "gh",
      storage,
      message: (s) => `Neu: ${s.title} (${s.url})`,
    });
    const payload = (reason: string) =>
      JSON.stringify({
        action: "closed",
        issue: {
          title: "Add a map",
          body: `x patina-followup:${key}`,
          state_reason: reason,
          html_url: "https://github.com/o/r/issues/1",
        },
      });
    const headers = (b: string) => ({
      "x-github-event": "issues",
      "x-hub-signature-256": `sha256=${sign("gh", b)}`,
    });
    const notPlanned = payload("not_planned");
    expect(await (await post(hook, notPlanned, headers(notPlanned))).json()).toEqual({
      ignored: true,
    });
    const done = payload("completed");
    expect(await (await post(hook, done, headers(done))).json()).toEqual({
      shipped: key,
      notices: 1,
    });
    const [n] = await storage.listNotices({ tenantId: "acme", userId: "ann", surfaceId: "data" });
    expect(n?.message).toBe("Neu: Add a map (https://github.com/o/r/issues/1)");
  });

  it("Jira: ships when the issue with the key label is done", async () => {
    await seed();
    const hook = followUpWebhook({ provider: "jira", secret: "j", storage });
    const body = JSON.stringify({
      webhookEvent: "jira:issue_updated",
      issue: {
        key: "PROJ-1",
        fields: {
          summary: "Add a map",
          labels: ["patina-followup", key],
          status: { statusCategory: { key: "done" } },
        },
      },
    });
    const res = await post(hook, body, { "x-hub-signature": `sha256=${sign("j", body)}` });
    expect(await res.json()).toEqual({ shipped: key, notices: 1 });
  });
});
