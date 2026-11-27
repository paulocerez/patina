import { readFileSync } from "node:fs";
import { apply, resolve, restrictManifest } from "@patina/core";
import { expect, it } from "vitest";
import { dashboard as demo } from "../../../examples/demo/server/surface.js";
import { USERS } from "../../../examples/demo/server/users.js";
import { dashboard } from "../../core/test/fixtures.js";
import { type EvalCase, normalize, runEval } from "../src/eval.js";
import { scriptedModel } from "../src/testing.js";

it("scores by resulting view, so equivalent patches both pass", async () => {
  const cases: EvalCase[] = [
    {
      id: "a",
      prompt: "status after date",
      expect: {
        kind: "patch",
        ops: [
          {
            op: "move",
            node: "appointments",
            prop: "columns",
            key: "status",
            to: { after: "date" },
          },
        ],
      },
    },
    { id: "b", prompt: "refuse me", expect: { kind: "refusal" } },
    {
      id: "c",
      prompt: "wrong",
      expect: {
        kind: "patch",
        ops: [{ op: "set", node: "appointments", path: ["pageSize"], value: 50 }],
      },
    },
  ];
  const model = scriptedModel((_r, prompt) => {
    if (prompt === "refuse me") return { kind: "refusal", message: "no", ops: [] };
    if (prompt === "wrong")
      return {
        kind: "patch",
        message: "",
        ops: [{ op: "set", node: "appointments", prop: "pageSize", value: 40 }],
      };
    // Same effect as the expected op, written differently.
    return {
      kind: "patch",
      message: "",
      ops: [
        {
          op: "move",
          node: "appointments",
          prop: "columns",
          key: "status",
          position: "before",
          anchor: "patient",
        },
      ],
    };
  });
  const { results, summary } = await runEval(cases, {
    surface: dashboard,
    model,
    contexts: { alice: { userId: "alice", permissions: ["finance.read"] } },
  });
  expect(results.map((r) => [r.id, r.pass])).toEqual([
    ["a", true],
    ["b", true],
    ["c", false],
  ]);
  expect(summary).toMatchObject({ total: 3, passed: 2, refusalPrecision: 1, refusalRecall: 1 });
});

it("normalizes user-inserted keys", () => {
  const a = apply(dashboard, dashboard.base, [
    { op: "insert", node: "kpis", prop: "cards", preset: "stat.noShows", key: "u_abc", to: "end" },
  ]).spec;
  const b = apply(dashboard, dashboard.base, [
    { op: "insert", node: "kpis", prop: "cards", preset: "stat.noShows", key: "u_xyz", to: "end" },
  ]).spec;
  expect(normalize(a)).toEqual(normalize(b));
});

it("every case in the shipped eval set is valid against the demo surface", () => {
  const lines = readFileSync(new URL("../../../evals/dashboard.jsonl", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean);
  for (const line of lines) {
    const c = JSON.parse(line) as EvalCase;
    const ctx = USERS[c.user ?? "alice"];
    expect(ctx, c.id).toBeDefined();
    const u = ctx as NonNullable<typeof ctx>;
    const m = restrictManifest(demo, { ...(demo.restrict?.(u) ?? {}), permissions: u.permissions });
    let spec = resolve(m, []).spec;
    for (const ops of c.history ?? []) spec = apply(m, spec, ops).spec;
    if (c.expect.kind === "patch") expect(apply(m, spec, c.expect.ops).skipped, c.id).toEqual([]);
  }
});
