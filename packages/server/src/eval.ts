/**
 * Eval runner.
 * @packageDocumentation
 * @module @patina-ui/server/eval
 */
/**
 * Eval runner: measures how well a model turns prompts into the right patches for a surface.
 * Each case runs through the real handler (restriction, validation, the repair round-trip),
 * and is scored by comparing the *resulting view*, not the op list, because different
 * patches can have the same effect.
 */
import {
  apply,
  deepEqual,
  type Manifest,
  type Op,
  type ProposeResponse,
  restrictManifest,
  type SurfaceSpec,
  type SurfaceState,
} from "@patina-ui/core";
import { createPatinaHandler, type PatinaContext } from "./handler.js";
import type { ModelAdapter } from "./model.js";
import { memoryStorage, type RequestEvent } from "./storage.js";

export type EvalKind = "patch" | "refusal" | "clarify" | "answer";

export interface EvalCase {
  id: string;
  prompt: string;
  /** Key into `contexts`. Defaults to the first context. */
  user?: string;
  /** Patches already saved for the user before the prompt, oldest first. */
  history?: Op[][];
  /** For "patch": ops whose *result* the model's patch must reproduce. */
  expect:
    | {
        kind: "patch";
        ops: Op[];
        /** Other op lists that are also correct (e.g. using an existing preset instead). */
        alternatives?: Op[][];
      }
    | {
        kind: "refusal";
        /** The refusal category it must have (e.g. "missing_field"). */
        category?: string;
        /** Detail it must have (as stored in the request log), e.g. { node: "recentCalls", wanted: "summary" }. */
        detail?: { node?: string; wanted?: string };
      }
    | {
        kind: "clarify";
        /** At most this many options (every option offered must be possible). */
        optionsMax?: number;
        /** At least this many options. */
        optionsMin?: number;
      }
    | {
        kind: "answer";
        /** Labels the answer must mention (e.g. column names). */
        mentions?: string[];
      };
  /** The question this prompt answers: sent as `thread`, like the React client does. */
  thread?: { prompt: string; question: string };
  /**
   * Raw model outputs, one per call, for `runEval(…, { scripted: true })`: replays a model's
   * answers (good or bad) to test what Patina does with them, without an API key.
   */
  script?: unknown[];
  /** Compare the result without caring about the order of items (when the prompt doesn't say where). */
  ignoreOrder?: boolean;
  /** The user's language (sent as x-patina-locale), e.g. "de". */
  locale?: string;
  /** Other outcomes that also count as a pass (e.g. refusal for an ambiguous prompt). */
  accept?: EvalKind[];
  note?: string;
}

export interface EvalResult {
  id: string;
  prompt: string;
  expected: EvalKind;
  got: EvalKind | "error";
  pass: boolean;
  /** Why it failed, or what the model said. */
  detail?: string;
  /** Model calls for this case (2 = one retry: repair or a second look at a refusal). */
  calls: number;
  ms: number;
  /** For refusals: the category and detail the request log got. */
  category?: string | null;
}

export interface EvalSummary {
  model: string;
  total: number;
  passed: number;
  accuracy: number;
  byExpected: Record<EvalKind, { total: number; passed: number }>;
  refusalPrecision: number | null;
  refusalRecall: number | null;
  repairRate: number;
  errors: number;
  latencyMs: { p50: number; p95: number };
}

export interface RunEvalOptions<Ctx extends PatinaContext> {
  surface: Manifest<NoInfer<Ctx>>;
  /** Not needed with `scripted`. */
  model?: ModelAdapter;
  /**
   * Answer every model call from the case's `script` instead of a model: tests the
   * deterministic parts (validation, the refusal guard, answers, clarification checks) in CI.
   */
  scripted?: boolean;
  /** Request contexts by name, e.g. { alice: {...}, bob: {...} }. */
  contexts: Record<string, Ctx>;
  concurrency?: number;
  onResult?(result: EvalResult): void;
}

export async function runEval<Ctx extends PatinaContext>(
  cases: EvalCase[],
  options: RunEvalOptions<Ctx>,
): Promise<{ results: EvalResult[]; summary: EvalSummary }> {
  const queue = [...cases];
  const results: EvalResult[] = [];
  const workers = Array.from({ length: Math.max(1, options.concurrency ?? 4) }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const r = await runCase(c, options);
      results.push(r);
      options.onResult?.(r);
    }
  });
  await Promise.all(workers);
  const order = new Map(cases.map((c, i) => [c.id, i]));
  results.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    results,
    summary: summarize(results, options.scripted ? "scripted" : (options.model?.id ?? "none")),
  };
}

async function runCase<Ctx extends PatinaContext>(
  c: EvalCase,
  o: RunEvalOptions<Ctx>,
): Promise<EvalResult> {
  const userName = c.user ?? Object.keys(o.contexts)[0] ?? "";
  const ctx = o.contexts[userName];
  const base = { id: c.id, prompt: c.prompt, expected: c.expect.kind, calls: 0, ms: 0 };
  if (!ctx) return { ...base, got: "error", pass: false, detail: `unknown user "${userName}"` };

  const storage = memoryStorage();
  const key = {
    tenantId: ctx.tenantId ?? null,
    layer: "user" as const,
    subjectId: ctx.userId,
    surfaceId: o.surface.id,
  };
  let seq = 0;
  for (const [i, ops] of (c.history ?? []).entries()) {
    const id = `h${i}`;
    await storage.append(
      key,
      { kind: "patch", id, patch: { id, schemaVersion: 1, baseVersion: o.surface.version, ops } },
      seq++,
    );
  }

  let calls = 0;
  let cause: string | null = null;
  const inner: ModelAdapter | undefined = o.scripted
    ? {
        id: "scripted",
        propose: async () => {
          const out = c.script?.[calls - 1];
          if (out === undefined) throw new Error(`script has no answer for call ${calls}`);
          return out;
        },
      }
    : o.model;
  if (!inner) return { ...base, got: "error", pass: false, detail: "no model and not scripted" };
  const counted: ModelAdapter = {
    id: inner.id,
    propose: (req, opts) => {
      calls++;
      return inner.propose(req, opts);
    },
  };
  const events: RequestEvent[] = [];
  const handler = createPatinaHandler<Ctx>({
    surfaces: [o.surface],
    storage,
    model: counted,
    getContext: () => ctx,
    // Keep the real cause of model failures for the report (the user only sees a generic message).
    onError: (e) => {
      cause = e instanceof Error ? e.message.slice(0, 300) : String(e);
    },
    onEvent: (e) => {
      events.push(e);
    },
    limits: { proposalsPerMinute: 0 },
  });
  const call = async <T>(method: string, path: string, body?: unknown) => {
    const res = await handler(
      new Request(`http://eval/surfaces/${encodeURIComponent(o.surface.id)}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(c.locale ? { "x-patina-locale": c.locale } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    const json = (await res.json()) as T & { error?: { message: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    return json;
  };

  const started = performance.now();
  try {
    const before = await call<SurfaceState>("GET", "");
    const r = await call<ProposeResponse>("POST", "/proposals", {
      prompt: c.prompt,
      ...(c.thread ? { thread: c.thread } : {}),
    });
    const ms = Math.round(performance.now() - started);
    const got: EvalKind = r.kind === "proposal" ? "patch" : r.kind;
    const accepted = new Set<EvalKind>([c.expect.kind, ...(c.accept ?? [])]);
    const event = events.at(-1);
    const said =
      r.kind === "refusal"
        ? `${r.message}${event?.reason ? ` [${event.reason}${event.detail?.node || event.detail?.wanted ? ` ${event.detail?.node ?? ""}.${event.detail?.wanted ?? ""}` : ""}]` : ""}`
        : r.kind === "clarify"
          ? `${r.question}${r.options?.length ? ` (${r.options.map((x) => x.label).join(" | ")})` : ""}`
          : r.kind === "answer"
            ? r.message.replace(/\n/g, " ")
            : r.changes.map((x) => x.text).join("; ");
    const result = { ...base, got, calls, ms, category: event?.reason ?? null };
    if (!accepted.has(got))
      return { ...result, pass: false, detail: `expected ${c.expect.kind}, got ${got}: ${said}` };
    const fail = checkKind(c, r, event);
    if (fail) return { ...result, pass: false, detail: `${fail}: ${said}` };
    if (got !== "patch" || c.expect.kind !== "patch" || r.kind !== "proposal")
      return { ...result, pass: true, detail: said };

    const m = restrictManifest(o.surface as Manifest<unknown>, {
      ...((await o.surface.restrict?.(ctx)) ?? {}),
      permissions: ctx.permissions ?? [],
    });
    const norm = (spec: SurfaceSpec) =>
      c.ignoreOrder ? sortLists(normalize(spec)) : normalize(spec);
    const actual = norm(r.previewSpec);
    let pass = false;
    for (const ops of [c.expect.ops, ...(c.expect.alternatives ?? [])]) {
      const expected = apply(m, before.spec, ops, "strict");
      if (expected.skipped.length) {
        return {
          ...base,
          got,
          pass: false,
          detail: `bad eval case: ${expected.skipped[0]?.message}`,
          calls,
          ms,
        };
      }
      if (deepEqual(actual, norm(expected.spec))) pass = true;
    }
    return { ...base, got, pass, detail: pass ? said : `wrong result: ${said}`, calls, ms };
  } catch (e) {
    return {
      ...base,
      got: "error",
      pass: false,
      detail: `${e instanceof Error ? e.message : String(e)}${cause ? ` (cause: ${cause})` : ""}`,
      calls,
      ms: Math.round(performance.now() - started),
    };
  }
}

/** Checks what the kind alone doesn't: category, detail, options, what an answer mentions. */
function checkKind(
  c: EvalCase,
  r: ProposeResponse,
  event: RequestEvent | undefined,
): string | null {
  const e = c.expect;
  if (e.kind === "refusal" && r.kind === "refusal") {
    if (e.category && event?.reason !== e.category)
      return `expected category ${e.category}, got ${event?.reason ?? "none"}`;
    if (e.detail?.node && event?.detail?.node !== e.detail.node)
      return `expected detail.node ${e.detail.node}, got ${event?.detail?.node ?? "none"}`;
    if (e.detail?.wanted && event?.detail?.wanted !== e.detail.wanted)
      return `expected detail.wanted ${e.detail.wanted}, got ${event?.detail?.wanted ?? "none"}`;
  }
  if (e.kind === "clarify" && r.kind === "clarify") {
    const n = r.options?.length ?? 0;
    if (e.optionsMax !== undefined && n > e.optionsMax)
      return `expected at most ${e.optionsMax} options, got ${n}`;
    if (e.optionsMin !== undefined && n < e.optionsMin)
      return `expected at least ${e.optionsMin} options, got ${n}`;
  }
  if (e.kind === "answer" && r.kind === "answer") {
    const missing = (e.mentions ?? []).filter((x) => !r.message.includes(x));
    if (missing.length) return `answer doesn't mention ${missing.join(", ")}`;
  }
  return null;
}

/** Sorts every keyed list (slots, collections) by key, for order-insensitive comparison. */
function sortLists(spec: SurfaceSpec): SurfaceSpec {
  const nodes = Object.fromEntries(
    Object.entries(spec.nodes).map(([id, n]) => [
      id,
      {
        ...n,
        props: Object.fromEntries(
          Object.entries(n.props).map(([k, v]) => [
            k,
            Array.isArray(v) &&
            v.every((it) => it && typeof it === "object" && "key" in (it as object))
              ? [...v].sort((a, b) =>
                  String((a as { key: string }).key).localeCompare(
                    String((b as { key: string }).key),
                  ),
                )
              : v,
          ]),
        ),
      },
    ]),
  );
  return { ...spec, nodes };
}

/** Renames user-inserted keys (random) to stable ones, in document order, so specs compare. */
export function normalize(spec: SurfaceSpec): SurfaceSpec {
  const rename = new Map<string, string>();
  const visit = (id: string) => {
    const node = spec.nodes[id];
    if (!node) return;
    for (const v of Object.values(node.props)) {
      if (!Array.isArray(v)) continue;
      for (const item of v as { key?: unknown }[]) {
        const k = item?.key;
        if (typeof k === "string" && k.startsWith("u_") && !rename.has(k))
          rename.set(k, `u_#${rename.size}`);
        if (typeof k === "string" && spec.nodes[k]) visit(k);
      }
    }
  };
  visit(spec.root);
  if (rename.size === 0) return spec;
  const json = JSON.stringify(spec).replace(/"(u_[A-Za-z0-9_-]+)"/g, (whole, k: string) =>
    rename.has(k) ? `"${rename.get(k)}"` : whole,
  );
  return JSON.parse(json) as SurfaceSpec;
}

function summarize(results: EvalResult[], model: string): EvalSummary {
  const kinds: EvalKind[] = ["patch", "refusal", "clarify", "answer"];
  const byExpected = Object.fromEntries(
    kinds.map((k) => {
      const of = results.filter((r) => r.expected === k);
      return [k, { total: of.length, passed: of.filter((r) => r.pass).length }];
    }),
  ) as EvalSummary["byExpected"];
  const refused = results.filter((r) => r.got === "refusal");
  const shouldRefuse = results.filter((r) => r.expected === "refusal");
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p: number) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))] ?? 0;
  const passed = results.filter((r) => r.pass).length;
  return {
    model,
    total: results.length,
    passed,
    accuracy: results.length ? passed / results.length : 0,
    byExpected,
    refusalPrecision: refused.length
      ? refused.filter((r) => r.expected === "refusal").length / refused.length
      : null,
    refusalRecall: shouldRefuse.length
      ? shouldRefuse.filter((r) => r.got === "refusal").length / shouldRefuse.length
      : null,
    repairRate: results.length ? results.filter((r) => r.calls > 1).length / results.length : 0,
    errors: results.filter((r) => r.got === "error").length,
    latencyMs: { p50: pct(50), p95: pct(95) },
  };
}
