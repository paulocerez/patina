/**
 * 0.7 reliability: a second look at refusals, the refusal guard, answers to "what can I …?",
 * clarifications that only offer what's possible (and at most one), undo that can't run away,
 * display-only fields, structured refusal detail and the startup warning.
 */
import { PGlite } from "@electric-sql/pglite";
import type { ProposeResponse, SurfaceState } from "@patina-ui/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFollowUps, renderFollowUpMarkdown } from "../src/followups.js";
import {
  createPatinaHandler,
  memoryStorage,
  migratePostgres,
  type RequestEvent,
  renderInsightsMarkdown,
  summarizeRequests,
} from "../src/index.js";
import { scriptedModel } from "../src/testing.js";
import { type CallsCtx, callsContexts, callsDashboard } from "./fixtures/calls-dashboard.js";

type Answer = (prompt: string, call: number, user: string) => unknown;

function setup(answer: Answer, extra: Record<string, unknown> = {}) {
  const storage = memoryStorage();
  const events: RequestEvent[] = [];
  const model = scriptedModel((req, prompt, call) => answer(prompt, call, req.user));
  const handler = createPatinaHandler<CallsCtx>({
    surfaces: [callsDashboard],
    storage,
    model,
    getContext: (r) => callsContexts[r.headers.get("x-user") ?? "after"] ?? null,
    onEvent: (e) => {
      events.push(e);
    },
    limits: { proposalsPerMinute: 0 },
    ...extra,
  });
  async function call<T>(method: string, path: string, body?: unknown, user = "after") {
    const res = await handler(
      new Request(`http://t/surfaces/calls.dashboard${path}`, {
        method,
        headers: { "content-type": "application/json", "x-patina-locale": "de", "x-user": user },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: res.status, body: (await res.json()) as T };
  }
  return { storage, events, model, call };
}

const refusal = (category: string, message: string, node = "", wanted = "") => ({
  kind: "refusal",
  message,
  category,
  detail: { node, wanted },
  ops: [],
});
const FALSE_CLAIM =
  "Der Standard-Zeitraum kann nur auf Letzte 7 Tage oder Letzte 30 Tage gesetzt werden.";
const setToday = {
  op: "set",
  node: "overview",
  prop: "defaultDateRange",
  value: "today",
};

describe('never refuse what the manifest allows ("Standard-Zeitraum auf Heute setzen")', () => {
  it("asks the backup model again, with the refusal and the allowed values in German", async () => {
    const t = setup((_p, call) =>
      call === 1
        ? refusal("other", FALSE_CLAIM)
        : { kind: "patch", message: "Auf Heute gesetzt.", ops: [setToday] },
    );
    const r = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "Standard-Zeitraum auf Heute setzen",
    });
    expect(r.body).toMatchObject({
      kind: "proposal",
      ops: [{ op: "set", node: "overview", path: ["defaultDateRange"], value: "today" }],
    });
    expect(t.model.calls).toHaveLength(2);
    const retry = t.model.calls[1]?.user ?? "";
    expect(retry).toContain(FALSE_CLAIM);
    expect(retry).toContain('today = "Heute"');
    expect(t.events[0]).toMatchObject({ outcome: "proposed", modelCalls: 2, source: null });
  });

  it("proposes it deterministically when both models refuse", async () => {
    const t = setup(() => refusal("other", FALSE_CLAIM));
    const r = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "Standard-Zeitraum auf Heute setzen",
    });
    expect(r.body).toMatchObject({
      kind: "proposal",
      ops: [{ op: "set", node: "overview", path: ["defaultDateRange"], value: "today" }],
    });
    expect(t.events[0]).toMatchObject({
      outcome: "proposed",
      source: "guard",
      reason: "rescued:other",
      modelCalls: 2,
    });
  });

  it("doesn't retry safety refusals", async () => {
    const t = setup(() => refusal("safety", "Nein."));
    const r = await t.call<ProposeResponse>("POST", "/proposals", { prompt: "something harmful" });
    expect(r.body).toMatchObject({ kind: "refusal", category: "safety" });
    expect(t.model.calls).toHaveLength(1);
  });
});

describe("answers instead of refusals", () => {
  it('answers "Was kann ich … anzeigen?" from the manifest, without a model call', async () => {
    const t = setup(() => {
      throw new Error("no model call expected");
    });
    const r = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "Was kann ich noch anzeigen lassen bei den letzten Anrufen?",
    });
    expect(r.body.kind).toBe("answer");
    if (r.body.kind !== "answer") return;
    expect(r.body.question).toBe(r.body.message); // clients before 0.7 show `question`
    for (const col of ["Kontakt", "Aufgabe", "Datum", "Status", "Zusammenfassung"])
      expect(r.body.message).toContain(col);
    expect(r.body.capabilities.arrange.map((a) => a.node)).toEqual(["recentCalls"]);
    expect(t.model.calls).toHaveLength(0);
    expect(t.events[0]).toMatchObject({
      outcome: "answered",
      modelCalls: 0,
      prompt: "Was kann ich noch anzeigen lassen bei den letzten Anrufen?",
    });
  });

  it("answers when the model recognizes a question the detector missed", async () => {
    const t = setup(() => ({
      kind: "answer",
      message: "ignored",
      detail: { node: "recentCalls", wanted: "" },
      ops: [],
    }));
    const r = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "Spalten der letzten Anrufe, Möglichkeiten?",
    });
    expect(r.body.kind).toBe("answer");
    expect(r.body.kind === "answer" && r.body.message).toContain("Zusammenfassung");
    expect(t.model.calls).toHaveLength(1);
  });
});

const P5 =
  "Ich würde die Heatmap durch ein Diagramm ersetzen, welches die Verteilung von Notfällen und anderen Anrufen zeigt";
const Q5 = "Nach Aufgabe, Status oder Anrufertyp?";
const hideHeatmap = {
  op: "setItem",
  node: "overview",
  prop: "sections",
  key: "heatmap",
  field: "hidden",
  value: true,
};
const chartBy = (field: string) => ({
  op: "insert",
  node: "overview",
  prop: "sections",
  preset: "block.chart",
  position: "end",
  anchor: "",
  props: { kind: "bar", query: { source: "calls", groupBy: { field }, metric: { op: "count" } } },
});

describe("clarifications", () => {
  it("only offer options whose ops are possible", async () => {
    const t = setup(() => ({
      kind: "clarify",
      message: Q5,
      options: [
        { label: "Nach Aufgabe", ops: [0, 1] },
        { label: "Nach Anrufertyp", ops: [0, 2] },
      ],
      ops: [hideHeatmap, chartBy("mainTask"), chartBy("callerType")],
    }));
    const r = await t.call<ProposeResponse>("POST", "/proposals", { prompt: P5 });
    expect(r.body).toEqual({ kind: "clarify", question: Q5, options: [{ label: "Nach Aufgabe" }] });
  });

  it("with no possible option, ask again (repair) and then refuse", async () => {
    const t = setup(() => ({
      kind: "clarify",
      message: Q5,
      options: [{ label: "Nach Anrufertyp", ops: [0] }],
      ops: [chartBy("callerType")],
    }));
    const r = await t.call<ProposeResponse>("POST", "/proposals", { prompt: P5 });
    expect(r.body).toMatchObject({ kind: "refusal", category: "unclear" });
    expect(t.model.calls).toHaveLength(2);
    expect(t.model.calls[1]?.user).toContain("none of its options is possible");
  });

  it("send the reply to the model with the original request and the question", async () => {
    const t = setup(() => ({
      kind: "patch",
      message: "ok",
      ops: [hideHeatmap, chartBy("mainTask")],
    }));
    const r = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "über die Notfallaufgabe",
      thread: { prompt: P5, question: Q5 },
    });
    expect(r.body.kind).toBe("proposal");
    const req = t.model.calls[0];
    expect(req?.user).toContain(`<earlier_request>\n${P5}\n</earlier_request>`);
    expect(req?.user).toContain(`<your_question>\n${Q5}\n</your_question>`);
    expect(req?.user).toContain("<request>\nüber die Notfallaufgabe\n</request>");
    // One clarification at most: the schema can't express another question.
    const props = req?.outputSchema.properties as { kind: { enum: string[] } } | undefined;
    const kinds = props?.kind.enum;
    expect(kinds).not.toContain("clarify");
    expect(t.events[0]?.detail).toMatchObject({ thread: { prompt: P5, question: Q5 } });
  });

  it("don't ask a second question, even if the model tries", async () => {
    const t = setup(() => ({
      kind: "clarify",
      message: "Welche Aufgabe genau?",
      options: [{ label: "Notfall", ops: [0] }],
      ops: [hideHeatmap],
    }));
    const r = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "über die Notfallaufgabe",
      thread: { prompt: P5, question: Q5 },
    });
    expect(r.body).toMatchObject({ kind: "refusal", category: "unclear" });
  });
});

describe("refusal detail", () => {
  it("is checked against the manifest and stored for grouping", async () => {
    const t = setup(() =>
      refusal("missing_field", "Keine Zusammenfassung.", "recentCalls", "call summary"),
    );
    await t.call("POST", "/proposals", { prompt: "Zusammenfassung zeigen" }, "before");
    expect(t.events[0]).toMatchObject({
      reason: "missing_field",
      detail: {
        node: "recentCalls",
        component: "RecentCallsTable",
        wanted: "callSummary",
      },
    });
  });

  it("notes a catalog field that exists but is restricted", async () => {
    const t = setup(() => refusal("missing_field", "Keine Dauer.", "", "duration"));
    await t.call("POST", "/proposals", { prompt: "Diagramm nach Anrufdauer" }, "before");
    expect(t.events[0]?.detail).toMatchObject({
      wanted: "duration",
      field: { source: "calls", field: "duration", privacy: "restricted" },
    });
  });

  it("drops a node that isn't on the page", async () => {
    const t = setup(() => refusal("missing_setting", "Nein.", "nope", "rowLimit"));
    await t.call("POST", "/proposals", { prompt: "10 Zeilen" });
    expect(t.events[0]?.detail).toMatchObject({ node: null, wanted: "rowLimit" });
  });
});

describe("undo that can't run away", () => {
  const hideTask = {
    op: "setItem",
    node: "overview",
    prop: "sections",
    key: "taskChart",
    field: "hidden",
    value: true,
  };
  async function withTwoChanges() {
    let n = 0;
    const t = setup(() => {
      n++;
      return { kind: "patch", message: "ok", ops: [n % 2 ? hideHeatmap : hideTask] };
    });
    for (const prompt of ["Heatmap ausblenden", "Aufgaben ausblenden"]) {
      const p = await t.call<ProposeResponse>("POST", "/proposals", { prompt });
      await t.call("POST", `/proposals/${(p.body as { proposalId: string }).proposalId}/commit`);
    }
    return t;
  }

  it("rejects a stale undo with 409 instead of undoing one more step", async () => {
    const t = await withTwoChanges();
    const s = await t.call<SurfaceState>("GET", "");
    expect(s.body.seq).toBe(2);
    const clicks = await Promise.all(
      [1, 2, 3, 4].map(() => t.call("POST", "/undo", { expectedSeq: s.body.seq })),
    );
    expect(clicks.map((c) => c.status).sort()).toEqual([200, 409, 409, 409]);
    const entries = await t.storage.list({
      tenantId: "t1",
      layer: "user",
      subjectId: "u1",
      surfaceId: "calls.dashboard",
    });
    expect(entries.filter((e) => e.kind === "revert")).toHaveLength(1);
  });

  it("redo takes back an accidental undo", async () => {
    const t = await withTwoChanges();
    const before = (await t.call<SurfaceState>("GET", "")).body;
    const undone = (await t.call<SurfaceState>("POST", "/undo", { expectedSeq: before.seq })).body;
    expect(undone.canRedo).toBe(true);
    const redone = (await t.call<SurfaceState>("POST", "/redo", { expectedSeq: undone.seq })).body;
    expect(redone.spec).toEqual(before.spec);
    expect(redone.canRedo).toBe(false);
  });

  it("clients without expectedSeq work as before", async () => {
    const t = await withTwoChanges();
    expect((await t.call("POST", "/undo")).status).toBe(200);
    expect((await t.call("POST", "/undo")).status).toBe(200);
  });
});

describe("display-only fields", () => {
  it("can be added as a table column, but never filtered on", async () => {
    let ask = 0;
    const t = setup(() => {
      ask++;
      // The first request lists the summary; the second one (and its repair) filters on it.
      return ask === 1
        ? {
            kind: "patch",
            message: "ok",
            ops: [
              {
                op: "insert",
                node: "overview",
                prop: "sections",
                preset: "block.table",
                position: "end",
                anchor: "",
                props: { query: { source: "calls", fields: ["date", "summary"] } },
              },
            ],
          }
        : {
            kind: "patch",
            message: "ok",
            ops: [
              {
                op: "insert",
                node: "overview",
                prop: "sections",
                preset: "block.table",
                position: "end",
                anchor: "",
                props: {
                  query: {
                    source: "calls",
                    fields: ["date"],
                    where: [{ field: "summary", value: "x" }],
                  },
                },
              },
            ],
          };
    });
    const ok = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "Tabelle mit Zusammenfassung",
    });
    expect(ok.body.kind).toBe("proposal");
    const no = await t.call<ProposeResponse>("POST", "/proposals", {
      prompt: "nach Zusammenfassung filtern",
    });
    expect(no.body).toMatchObject({ kind: "refusal" });
    expect(no.body.kind === "refusal" && no.body.message).toMatch(/Spalte/);
  });
});

describe("observability", () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns once at startup when no prompt would be recorded anywhere", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const make = (o: Record<string, unknown>) =>
      createPatinaHandler({
        surfaces: [callsDashboard],
        storage: memoryStorage(),
        model: scriptedModel(() => ({})),
        getContext: () => null,
        ...o,
      });
    make({});
    make({ logRequests: false, onEvent: () => {} });
    expect(warn).not.toHaveBeenCalled();
    make({ logRequests: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/onEvent/);
  });
});

describe("insights and follow-ups from refusal detail", () => {
  const ev = (id: string, prompt: string, tenantId: string): RequestEvent => ({
    id,
    at: "2026-11-20T10:00:00.000Z",
    surfaceId: "calls.dashboard",
    userId: `u-${id}`,
    tenantId,
    prompt,
    outcome: "refused",
    reason: "missing_field",
    source: "model",
    message: null,
    proposalId: null,
    model: "m",
    latencyMs: 1,
    modelCalls: 2,
    detail: { node: "recentCalls", component: "RecentCallsTable", wanted: "summary" },
  });
  const events = [
    ev("1", "Kurzzusammenfassung des Anrufs in den letzten Anrufen", "t1"),
    ev("2", "Die Anrufzusammenfassung in jeder Zeile der letzten Anrufe", "t2"),
  ];

  it('groups "summary column on recentCalls × 2" and suggests the manifest change', () => {
    const report = summarizeRequests(events);
    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toMatchObject({ count: 2, tenants: 2, wanted: "summary" });
    expect(report.suggestions[0]?.text).toContain(
      "Add a `summary` column or field to RecentCallsTable",
    );
    expect(renderInsightsMarkdown(report)).toContain("## Suggested manifest changes");
  });

  it("merges differently worded requests into one follow-up, with the suggested change", async () => {
    const { followUps } = await buildFollowUps(events, {
      window: { since: "2026-11-01T00:00:00.000Z", until: "2026-11-30T00:00:00.000Z" },
    });
    expect(followUps).toHaveLength(1);
    expect(followUps[0]?.count).toBe(2);
    expect(renderFollowUpMarkdown(followUps[0] as never)).toContain("**Suggested change:**");
  });
});

it("migratePostgres adds the detail column to a request log from an earlier version", async () => {
  const db = new PGlite();
  const query = (sql: string, params?: unknown[]) => db.query<Record<string, unknown>>(sql, params);
  await query(`create table patina_requests (
    id text primary key, created_at timestamptz not null default now(),
    tenant_id text not null default '', surface_id text not null, user_id text not null,
    prompt text null, outcome text not null, reason text null, source text null,
    message text null, proposal_id text null, model text null,
    latency_ms integer null, model_calls integer null)`);
  await migratePostgres(query);
  const { rows } = await query(
    "select column_name from information_schema.columns where table_name = 'patina_requests' and column_name = 'detail'",
  );
  expect(rows).toHaveLength(1);
});
