/**
 * Runs the eval set against a model and prints a report.
 *
 *   pnpm eval                                # the default: Haiku 5.5, with Sonnet 5.5 as backup
 *   pnpm eval --model claude-sonnet-5-5      # a single model
 *   pnpm eval --model claude-haiku-5-5 --backup claude-opus-5-5   # any pair
 *   pnpm eval --model offline                # the demo's keyword model (free; a baseline)
 *   pnpm eval --filter refuse --concurrency 2 --cases dashboard.jsonl
 *   pnpm eval --surface calls --cases real-de.jsonl   # the first real host's prompts (German)
 *   pnpm eval --surface calls --cases real-de.jsonl --model scripted
 *                                            # replays each case's recorded model answers (free)
 *
 * Every run against a real model costs money: ~49 cases, 1–2 calls each.
 * Results are also written to evals/results/<timestamp>.json (gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { ModelAdapter } from "@patina-ui/server";
import { type EvalCase, runEval } from "@patina-ui/server/eval";
import {
  callsContexts,
  callsDashboard,
} from "../packages/server/test/fixtures/calls-dashboard.js";
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
    backup: { type: "string" },
    surface: { type: "string", default: "demo" },
  },
});
const scripted = values.model === "scripted";

async function pickModel(): Promise<ModelAdapter | undefined> {
  if (scripted) return undefined;
  if (values.model === "offline") return offlineModel();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Use --model offline for a free baseline run.");
    process.exit(1);
  }
  const { anthropicModel } = await import("@patina-ui/server/anthropic");
  return anthropicModel({
    ...(values.model ? { model: values.model, backupModel: values.backup ?? null } : {}),
    ...(values.effort ? { effort: values.effort as "low" } : {}),
  });
}

const cases = readFileSync(join(here, values.cases as string), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as EvalCase)
  .filter((c) => !values.filter || c.id.includes(values.filter));

const model = await pickModel();
console.log(`Running ${cases.length} cases against ${model?.id ?? "the recorded answers"}\n`);

const target =
  values.surface === "calls"
    ? { surface: callsDashboard, contexts: callsContexts }
    : { surface: dashboard, contexts: USERS };
const { results, summary } = await runEval(cases, {
  ...(target as { surface: typeof dashboard; contexts: typeof USERS }),
  ...(model ? { model } : {}),
  scripted,
  concurrency: Number(values.concurrency),
  onResult: (r) => {
    const mark = r.pass ? "✓" : "✗";
    const repair = r.calls > 1 ? " (2 calls)" : "";
    console.log(
      `${mark} ${r.id.padEnd(28)} ${String(r.ms).padStart(6)}ms${repair}  ${r.pass ? "" : (r.detail ?? "")}`,
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
  answers         ${summary.byExpected.answer.passed}/${summary.byExpected.answer.total}
Refusal precision ${pct(summary.refusalPrecision)}   recall ${pct(summary.refusalRecall)}
Retry rate        ${pct(summary.repairRate)}
Errors            ${summary.errors}
Latency           p50 ${summary.latencyMs.p50}ms   p95 ${summary.latencyMs.p95}ms`);

const outDir = join(here, "results");
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
console.log(`\nWrote ${file}`);
