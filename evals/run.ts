/**
 * Runs the eval set against a model and prints a report.
 *
 *   pnpm eval                                # Claude (needs ANTHROPIC_API_KEY), default model
 *   pnpm eval --model claude-sonnet-5-5      # another Claude model
 *   pnpm eval --model offline                # the demo's keyword model (free; a baseline)
 *   pnpm eval --filter refuse --concurrency 2 --cases dashboard.jsonl
 *
 * Every run against a real model costs money: ~49 cases, 1–2 calls each.
 * Results are also written to evals/results/<timestamp>.json (gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { ModelAdapter } from "@patina/server";
import { type EvalCase, runEval } from "@patina/server/eval";
import { offlineModel } from "../examples/demo/server/offlineModel.js";
import { dashboard } from "../examples/demo/server/surface.js";
import { USERS } from "../examples/demo/server/users.js";

const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string" },
    cases: { type: "string", default: "dashboard.jsonl" },
    filter: { type: "string" },
    concurrency: { type: "string", default: "4" },
    effort: { type: "string" },
  },
});

async function pickModel(): Promise<ModelAdapter> {
  if (values.model === "offline") return offlineModel();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Use --model offline for a free baseline run.");
    process.exit(1);
  }
  const { anthropicModel } = await import("@patina/server/anthropic");
  return anthropicModel({
    ...(values.model ? { model: values.model } : {}),
    ...(values.effort ? { effort: values.effort as "low" } : {}),
  });
}

const cases = readFileSync(join(here, values.cases as string), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as EvalCase)
  .filter((c) => !values.filter || c.id.includes(values.filter));

const model = await pickModel();
console.log(`Running ${cases.length} cases against ${model.id}\n`);

const { results, summary } = await runEval(cases, {
  surface: dashboard,
  model,
  contexts: USERS,
  concurrency: Number(values.concurrency),
  onResult: (r) => {
    const mark = r.pass ? "✓" : "✗";
    const repair = r.calls > 1 ? " (repaired)" : "";
    console.log(
      `${mark} ${r.id.padEnd(16)} ${String(r.ms).padStart(6)}ms${repair}  ${r.pass ? "" : (r.detail ?? "")}`,
    );
  },
});

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
console.log(`
Model             ${summary.model}
Accuracy          ${summary.passed}/${summary.total} (${pct(summary.accuracy)})
  patches         ${summary.byExpected.patch.passed}/${summary.byExpected.patch.total}
  refusals        ${summary.byExpected.refusal.passed}/${summary.byExpected.refusal.total}
  clarifications  ${summary.byExpected.clarify.passed}/${summary.byExpected.clarify.total}
Refusal precision ${pct(summary.refusalPrecision)}   recall ${pct(summary.refusalRecall)}
Repair rate       ${pct(summary.repairRate)}
Errors            ${summary.errors}
Latency           p50 ${summary.latencyMs.p50}ms   p95 ${summary.latencyMs.p95}ms`);

const outDir = join(here, "results");
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
console.log(`\nWrote ${file}`);
