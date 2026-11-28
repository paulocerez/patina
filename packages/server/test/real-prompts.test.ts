/**
 * The first real host's prompts (German, from production) as a regression set, against a
 * dashboard shaped like theirs (fixtures/calls-dashboard.ts).
 *
 * In CI every case replays scripted model answers, including the bad ones production saw (a
 * false refusal of "Heute", a clarification offering an impossible option, "other" refusals),
 * and asserts what Patina does with them. With PATINA_LIVE_EVAL=1 (and ANTHROPIC_API_KEY) the
 * same cases run against the real model and the pass rate is printed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type EvalCase, runEval } from "../src/eval.js";
import { callsContexts, callsDashboard } from "./fixtures/calls-dashboard.js";

const here = dirname(fileURLToPath(import.meta.url));
const cases = readFileSync(join(here, "../../../evals/real-de.jsonl"), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as EvalCase);

describe("real prompts (scripted model answers)", () => {
  it("has the 19 distinct production prompts", () => {
    expect(new Set(cases.map((c) => c.prompt)).size).toBe(19);
  });

  for (const c of cases)
    it(`${c.id}: ${c.prompt}`, async () => {
      const { results } = await runEval([c], {
        surface: callsDashboard,
        contexts: callsContexts,
        scripted: true,
      });
      const r = results[0];
      expect(r?.pass ? "pass" : (r?.detail ?? "failed")).toBe("pass");
      // Never more than the one retry.
      expect(r?.calls ?? 0).toBeLessThanOrEqual(2);
    });
});

describe.runIf(process.env.PATINA_LIVE_EVAL === "1")("real prompts (live model)", () => {
  it("reports a pass rate", { timeout: 600_000 }, async () => {
    const { anthropicModel } = await import("../src/anthropic.js");
    const { results, summary } = await runEval(cases, {
      surface: callsDashboard,
      contexts: callsContexts,
      model: anthropicModel(),
      concurrency: 4,
    });
    for (const r of results)
      console.log(`${r.pass ? "✓" : "✗"} ${r.id.padEnd(28)} ${r.calls} call(s)  ${r.detail ?? ""}`);
    const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");
    console.log(
      `\n${summary.model}: ${summary.passed}/${summary.total} (${pct(summary.passed, summary.total)})`,
      Object.entries(summary.byExpected)
        .map(([k, v]) => `${k} ${v.passed}/${v.total}`)
        .join(" · "),
    );
    expect(summary.total).toBe(cases.length);
  });
});
