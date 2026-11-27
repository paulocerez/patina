import {
  apply,
  buildModelRequest,
  dataPresetIds,
  describe,
  fromModelOutput,
  headSeq,
  type Issue,
  type Layer,
  type Manifest,
  type Op,
  type ProposeResponse,
  publicCatalog,
  removeNodes,
  resolve,
  restrictManifest,
  type SurfaceSpec,
  type SurfaceState,
  undoTarget,
  validate,
  withoutDataViews,
} from "@patina-ui/core";
import { getInsights, parseSince, renderInsightsMarkdown } from "./insights.js";
import { type ModelAdapter, ModelRefusal } from "./model.js";
import {
  ConflictError,
  type Entry,
  type HistoryKey,
  type NewEntry,
  type RequestEvent,
  type StorageAdapter,
} from "./storage.js";

/** What the host knows about the caller. Always derived from the host's own session. */
export interface PatinaContext {
  userId: string;
  tenantId?: string | null;
  /** Checked against catalog `requires` (fields and sources). */
  permissions?: string[];
}

/** What a user may do on a surface. Returned by the `availability` hook; every field is optional. */
export interface AvailabilityRule {
  /** May change this view at all: prompt, apply, undo, reset. Default true. */
  customize?: boolean;
  /** May create or edit data views (charts, tables and cards from the catalog). Default true. */
  dataViews?: boolean;
  /**
   * What users who lose access see.
   * - "keep" (default): their saved customizations stay; they just can't make new ones.
   * - "base": they see the default view; their history is kept and comes back if access does.
   */
  whenOff?: "keep" | "base";
  /** Shown to the user when something is unavailable. */
  message?: string;
}

interface Availability {
  customize: boolean;
  dataViews: boolean;
  whenOff: "keep" | "base";
  message?: string;
}

const DEFAULT_OFF_MESSAGE = "Customizing this view isn't available on your account.";
const DEFAULT_DATA_VIEWS_MESSAGE =
  "Creating new charts, tables and cards isn't available on your account.";

export interface PatinaHandlerOptions<Ctx extends PatinaContext> {
  // NoInfer: Ctx is inferred from getContext; a manifest may need only part of it.
  surfaces: Manifest<NoInfer<Ctx>>[];
  storage: StorageAdapter;
  model: ModelAdapter;
  /** Return the caller's identity from the host session, or null if not signed in (→ 401). */
  getContext(request: Request): Ctx | null | Promise<Ctx | null>;
  /** Path the handler is mounted at, e.g. "/api/patina". Default: "". */
  basePath?: string;
  /**
   * Who may customize, per user and surface. Called on every request; can be async, so it can
   * ask a feature-flag service or your billing. Default: everything on.
   *
   *   availability: async (ctx) => ({
   *     customize: await flags.isEnabled("patina", ctx),
   *     dataViews: ctx.plan !== "free",
   *   })
   */
  availability?(ctx: NoInfer<Ctx>, surfaceId: string): AvailabilityRule | Promise<AvailabilityRule>;
  limits?: {
    /** Default 500. */
    promptMaxChars?: number;
    /** Default 10 per user per minute. 0 disables the limit. */
    proposalsPerMinute?: number;
    /** How long a preview can be committed. Default 900 s. */
    proposalTtlSeconds?: number;
    /**
     * Monthly quota of customization requests (each one is a model call), per user and/or per
     * tenant. Return undefined for no limit. Needs a storage adapter with `incrementUsage`.
     *
     *   monthlyProposals: (ctx) => (ctx.plan === "pro" ? { user: 500 } : { user: 20, tenant: 200 })
     */
    monthlyProposals?(ctx: NoInfer<Ctx>): { user?: number; tenant?: number } | null | undefined;
  };
  /** Called with unexpected errors (they are returned to the client as a generic 500). */
  onError?(error: unknown): void;
  /**
   * Called once per customization request with what happened (proposed, applied, refused,
   * clarified, unavailable, over_quota, error) and why. Forward it to your analytics.
   * Errors thrown here are reported to onError and never affect the user.
   */
  onEvent?(event: RequestEvent): void | Promise<void>;
  /** Store the request log through the storage adapter (if it supports it). Default true. */
  logRequests?: boolean;
  /**
   * Enables `GET {basePath}/insights` for the users you allow (e.g. your own staff): a report of
   * what customers asked for, what was refused and why. See docs/guides/insights.md.
   */
  insights?: { allow(ctx: NoInfer<Ctx>): boolean | Promise<boolean> };
}

/** Does any op add a data block or change a data query? */
function touchesDataViews(m: Manifest<unknown>, spec: SurfaceSpec, ops: Op[]): boolean {
  const dataPresets = new Set(dataPresetIds(m));
  return ops.some((op) => {
    if (op.op === "insert") return dataPresets.has(op.preset);
    if (op.op !== "set") return false;
    const node = spec.nodes[op.node];
    return m.components[node?.component ?? ""]?.props[op.path[0]]?.kind === "query";
  });
}

type LoggedFields = Pick<RequestEvent, "outcome" | "reason" | "source">;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** How to record this in the request log, if it should be. */
    readonly log?: LoggedFields,
  ) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const newId = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;

/**
 * Creates the Patina request handler: `(Request) => Promise<Response>`.
 * Mount it under `basePath` in any framework that speaks the Fetch API, or wrap it with
 * `toExpress` from "@patina-ui/server/express".
 */
export function createPatinaHandler<Ctx extends PatinaContext>(options: PatinaHandlerOptions<Ctx>) {
  const surfaces = new Map(options.surfaces.map((s) => [s.id, s]));
  const basePath = (options.basePath ?? "").replace(/\/$/, "");
  const promptMaxChars = options.limits?.promptMaxChars ?? 500;
  const perMinute = options.limits?.proposalsPerMinute ?? 10;
  const ttl = options.limits?.proposalTtlSeconds ?? 900;
  const recent = new Map<string, number[]>();
  if (options.limits?.monthlyProposals && !options.storage.incrementUsage)
    throw new Error("limits.monthlyProposals needs a storage adapter with incrementUsage().");

  async function availabilityFor(ctx: Ctx, surfaceId: string): Promise<Availability> {
    const rule = (await options.availability?.(ctx, surfaceId)) ?? {};
    const customize = rule.customize ?? true;
    return {
      customize,
      dataViews: customize && (rule.dataViews ?? true),
      whenOff: rule.whenOff ?? "keep",
      ...(rule.message ? { message: rule.message } : {}),
    };
  }

  async function checkQuota(ctx: Ctx) {
    const q = options.limits?.monthlyProposals?.(ctx);
    const increment = options.storage.incrementUsage?.bind(options.storage);
    if (!q || !increment) return;
    const period = new Date().toISOString().slice(0, 7);
    const tenantId = ctx.tenantId ?? null;
    if (q.user !== undefined) {
      const n = await increment({ tenantId, subjectId: ctx.userId, period });
      if (n > q.user)
        throw new HttpError(
          429,
          `You've used all ${q.user} customization requests for this month.`,
          { outcome: "over_quota", reason: "quota_user", source: "host" },
        );
    }
    if (q.tenant !== undefined && tenantId) {
      const n = await increment({ tenantId, subjectId: "*", period });
      if (n > q.tenant)
        throw new HttpError(
          429,
          "Your organization has used all its customization requests for this month.",
          { outcome: "over_quota", reason: "quota_tenant", source: "host" },
        );
    }
  }

  const logRequests = options.logRequests !== false && !!options.storage.logRequest;

  /** Writes one request-log event and forwards it to onEvent. Never throws. */
  async function record(e: Omit<RequestEvent, "id" | "at">) {
    const event: RequestEvent = { id: newId("rq"), at: new Date().toISOString(), ...e };
    try {
      if (logRequests) await options.storage.logRequest?.(event);
    } catch (err) {
      options.onError?.(err);
    }
    try {
      await options.onEvent?.(event);
    } catch (err) {
      options.onError?.(err);
    }
  }

  function rateLimit(ctx: Ctx) {
    if (!perMinute) return;
    const k = `${ctx.tenantId ?? ""}:${ctx.userId}`;
    const now = Date.now();
    const times = (recent.get(k) ?? []).filter((t) => now - t < 60_000);
    if (times.length >= perMinute)
      throw new HttpError(429, "That's a lot of changes at once. Try again in a minute.", {
        outcome: "over_quota",
        reason: "rate_limit",
        source: "host",
      });
    times.push(now);
    recent.set(k, times);
  }

  function keyFor(ctx: Ctx, surfaceId: string): HistoryKey {
    return { tenantId: ctx.tenantId ?? null, layer: "user", subjectId: ctx.userId, surfaceId };
  }

  async function load(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability) {
    const m = restrictManifest(manifest, {
      ...(manifest.restrict?.(ctx) ?? {}),
      permissions: ctx.permissions ?? [],
    });
    const key = keyFor(ctx, manifest.id);
    const tenantKey: HistoryKey | null = ctx.tenantId
      ? { tenantId: ctx.tenantId, layer: "tenant", subjectId: ctx.tenantId, surfaceId: manifest.id }
      : null;
    const [userEntries, tenantEntries] = await Promise.all([
      options.storage.list(key),
      tenantKey ? options.storage.list(tenantKey) : Promise.resolve([] as Entry[]),
    ]);
    // whenOff "base": users without access see the view without their own layer (kept in storage).
    const hideUserLayer = !av.customize && av.whenOff === "base";
    const layers: Layer[] = [
      { name: "tenant", entries: tenantEntries },
      { name: "user", entries: hideUserLayer ? [] : userEntries },
    ];
    const resolved = resolve(m as Manifest<unknown>, layers);
    if (!av.dataViews && av.whenOff === "base") {
      const dataPresets = new Set(dataPresetIds(m as Manifest<unknown>));
      const blocks = Object.entries(resolved.spec.nodes)
        .filter(([, n]) => n.preset && dataPresets.has(n.preset))
        .map(([id]) => id);
      resolved.spec = removeNodes(m as Manifest<unknown>, resolved.spec, new Set(blocks));
    }
    // What edits are checked against: without data views, blocks can't be added or changed.
    const me = (av.dataViews ? m : withoutDataViews(m)) as Manifest<unknown>;
    return { m: m as Manifest<unknown>, me, key, userEntries, resolved };
  }

  function state(
    manifest: Manifest<Ctx>,
    loaded: Awaited<ReturnType<typeof load>>,
    av: Availability,
  ): SurfaceState {
    const slots: Record<string, string[]> = {};
    const collections: Record<string, string[]> = {};
    for (const [name, comp] of Object.entries(manifest.components)) {
      for (const [prop, def] of Object.entries(comp.props)) {
        const into = def.kind === "slot" ? slots : def.kind === "collection" ? collections : null;
        if (into) into[name] = [...(into[name] ?? []), prop];
      }
    }
    return {
      surfaceId: manifest.id,
      spec: loaded.resolved.spec,
      skipped: loaded.resolved.skipped
        .filter((s) => s.layer === "user")
        .map((s) => ({ message: s.message, patchId: s.patchId })),
      canUndo: av.customize && undoTarget(loaded.userEntries) !== null,
      isCustomized: loaded.resolved.patchCount > 0,
      render: { slots, collections },
      ...(loaded.m.catalog ? { catalog: publicCatalog(loaded.m.catalog) } : {}),
      availability: {
        customize: av.customize,
        dataViews: av.dataViews,
        ...(!av.customize
          ? { message: av.message ?? DEFAULT_OFF_MESSAGE }
          : !av.dataViews
            ? { message: av.message ?? DEFAULT_DATA_VIEWS_MESSAGE }
            : {}),
      },
    };
  }

  async function appendWithRetry(
    manifest: Manifest<Ctx>,
    ctx: Ctx,
    av: Availability,
    build: (loaded: Awaited<ReturnType<typeof load>>) => NewEntry | null,
  ) {
    for (let attempt = 0; ; attempt++) {
      const loaded = await load(manifest, ctx, av);
      const entry = build(loaded);
      if (!entry) return loaded;
      try {
        await options.storage.append(loaded.key, entry, headSeq(loaded.userEntries));
        return load(manifest, ctx, av);
      } catch (e) {
        if (!(e instanceof ConflictError) || attempt >= 2) throw e;
      }
    }
  }

  type Meta = { reason: string | null; source: RequestEvent["source"]; modelCalls: number };

  async function propose(
    manifest: Manifest<Ctx>,
    ctx: Ctx,
    av: Availability,
    prompt: string,
  ): Promise<{ response: ProposeResponse; meta: Meta }> {
    if (!prompt) throw new HttpError(400, "Type what you'd like to change.");
    if (prompt.length > promptMaxChars)
      throw new HttpError(400, `Please keep requests under ${promptMaxChars} characters.`);
    rateLimit(ctx);
    await checkQuota(ctx);

    const loaded = await load(manifest, ctx, av);
    const m = loaded.me;
    const spec = loaded.resolved.spec;
    const request = buildModelRequest(m, spec, prompt);
    const done = (
      response: ProposeResponse,
      reason: string | null,
      source: Meta["source"],
      modelCalls: number,
    ) => ({
      response,
      meta: { reason, source, modelCalls },
    });

    let issues: Issue[] = [];
    let lastOps: Op[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const calls = attempt + 1;
      const req =
        attempt === 0
          ? request
          : {
              ...request,
              user: `${request.user}\n\n<problems_with_previous_answer>\n${issues.map((i) => `- op ${i.opIndex}: ${i.message}`).join("\n")}\n</problems_with_previous_answer>\nAnswer again, fixing these problems, or refuse if the request can't be done.`,
            };
      let raw: unknown;
      try {
        raw = await options.model.propose(req, { signal: AbortSignal.timeout(60_000) });
      } catch (e) {
        if (e instanceof ModelRefusal)
          return done({ kind: "refusal", message: e.message }, "safety", "model", calls);
        options.onError?.(e);
        throw new HttpError(502, "The assistant is unavailable right now. Please try again.", {
          outcome: "error",
          reason: "model_unavailable",
          source: null,
        });
      }
      const result = fromModelOutput(raw);
      if (result.kind === "refusal")
        return done({ kind: "refusal", message: result.reason }, result.category, "model", calls);
      if (result.kind === "clarify")
        return done({ kind: "clarify", question: result.question }, null, "model", calls);
      if (result.ops.length === 0)
        return done(
          {
            kind: "refusal",
            message: "I couldn't find anything on this page to change for that request.",
          },
          "no_change",
          "model",
          calls,
        );

      lastOps = result.ops;
      issues = validate(m, spec, result.ops);
      if (issues.length === 0) {
        const proposalId = newId("pr");
        await options.storage.saveProposal({
          id: proposalId,
          key: loaded.key,
          baseSeq: headSeq(loaded.userEntries),
          ops: result.ops,
          summary: result.summary,
          prompt,
          model: options.model.id,
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        });
        return done(
          {
            kind: "proposal",
            proposalId,
            ops: result.ops,
            changes: describe(m, spec, result.ops),
            summary: result.summary,
            previewSpec: apply(m, spec, result.ops).spec,
          },
          null,
          null,
          calls,
        );
      }
    }
    // Asked for a data view without access to data views: say why, not which op failed.
    if (!av.dataViews && touchesDataViews(loaded.m, spec, lastOps))
      return done(
        { kind: "refusal", message: av.message ?? DEFAULT_DATA_VIEWS_MESSAGE },
        "data_views_off",
        "host",
        2,
      );
    return done(
      { kind: "refusal", message: issues[0]?.message ?? "That change isn't possible here." },
      issues[0]?.code ?? null,
      "validator",
      2,
    );
  }

  async function commit(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability, proposalId: string) {
    const proposal = await options.storage.takeProposal(proposalId, keyFor(ctx, manifest.id));
    if (!proposal) throw new HttpError(409, "This preview has expired. Please ask again.");
    let stale = false;
    const after = await appendWithRetry(manifest, ctx, av, (loaded) => {
      if (validate(loaded.me, loaded.resolved.spec, proposal.ops).length > 0) {
        stale = true;
        return null;
      }
      const id = newId("p");
      return {
        kind: "patch",
        id,
        patch: {
          id,
          schemaVersion: 1,
          baseVersion: manifest.version,
          ops: proposal.ops,
          summary: proposal.summary,
        },
        prompt: proposal.prompt,
        summary: proposal.summary,
        model: proposal.model,
      };
    });
    if (stale) throw new HttpError(409, "Your view changed since this preview. Please ask again.");
    await record({
      surfaceId: manifest.id,
      userId: ctx.userId,
      tenantId: ctx.tenantId ?? null,
      prompt: proposal.prompt,
      outcome: "applied",
      reason: null,
      source: null,
      message: null,
      proposalId: proposal.id,
      model: proposal.model,
      latencyMs: null,
      modelCalls: null,
    });
    return state(manifest, after, av);
  }

  async function undo(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability) {
    const after = await appendWithRetry(manifest, ctx, av, (loaded) => {
      const target = undoTarget(loaded.userEntries);
      return target ? { kind: "revert", id: newId("r"), targetId: target.id } : null;
    });
    return state(manifest, after, av);
  }

  async function reset(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability) {
    const after = await appendWithRetry(manifest, ctx, av, (loaded) =>
      loaded.resolved.patchCount > 0 || loaded.userEntries.length > 0
        ? { kind: "reset", id: newId("x") }
        : null,
    );
    return state(manifest, after, av);
  }

  async function insightsRoute(request: Request, url: URL): Promise<Response> {
    if (!options.insights) return json({ error: { message: "Not found" } }, 404);
    if (request.method !== "GET") return json({ error: { message: "Not found" } }, 404);
    const ctx = await options.getContext(request);
    if (!ctx?.userId) return json({ error: { message: "Not signed in" } }, 401);
    if (!(await options.insights.allow(ctx)))
      return json({ error: { message: "Not allowed" } }, 403);
    const q = url.searchParams;
    const report = await getInsights(options.storage, {
      since: parseSince(q.get("since") ?? "30d"),
      ...(q.get("until") ? { until: q.get("until") as string } : {}),
      ...(q.get("tenant") ? { tenantId: q.get("tenant") as string } : {}),
      ...(q.get("surface") ? { surfaceId: q.get("surface") as string } : {}),
    });
    if (q.get("format") === "markdown")
      return new Response(renderInsightsMarkdown(report), {
        headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
      });
    return json(report);
  }

  return async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith(basePath)) return json({ error: { message: "Not found" } }, 404);
      const parts = url.pathname
        .slice(basePath.length)
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent);
      if (parts[0] === "insights" && parts.length === 1) return await insightsRoute(request, url);
      if (parts[0] !== "surfaces" || !parts[1])
        return json({ error: { message: "Not found" } }, 404);

      const manifest = surfaces.get(parts[1]);
      if (!manifest) return json({ error: { message: "Unknown surface" } }, 404);
      const ctx = await options.getContext(request);
      if (!ctx?.userId) return json({ error: { message: "Not signed in" } }, 401);

      const route = `${request.method} ${parts
        .slice(2)
        .join("/")
        .replace(/^proposals\/[^/]+\/commit$/, "proposals/:id/commit")}`;
      const body = async () => {
        if (!(request.headers.get("content-type") ?? "").includes("application/json")) return {};
        try {
          return await request.json();
        } catch {
          throw new HttpError(400, "Invalid JSON body");
        }
      };

      const av = await availabilityFor(ctx, manifest.id);

      if (route === "POST proposals") {
        // Every customization request is logged with its outcome, including refusals.
        const started = performance.now();
        const b = (await body()) as { prompt?: unknown };
        const prompt = typeof b?.prompt === "string" ? b.prompt.trim() : "";
        const base = {
          surfaceId: manifest.id,
          userId: ctx.userId,
          tenantId: ctx.tenantId ?? null,
          prompt: prompt ? prompt.slice(0, 2000) : null,
          model: options.model.id,
          proposalId: null,
        };
        const ms = () => Math.round(performance.now() - started);
        try {
          if (!av.customize)
            throw new HttpError(403, av.message ?? DEFAULT_OFF_MESSAGE, {
              outcome: "unavailable",
              reason: "customize_off",
              source: "host",
            });
          const { response, meta } = await propose(manifest, ctx, av, prompt);
          await record({
            ...base,
            outcome:
              response.kind === "proposal"
                ? "proposed"
                : response.kind === "refusal"
                  ? "refused"
                  : "clarified",
            reason: meta.reason,
            source: meta.source,
            message:
              response.kind === "refusal"
                ? response.message
                : response.kind === "clarify"
                  ? response.question
                  : null,
            proposalId: response.kind === "proposal" ? response.proposalId : null,
            latencyMs: ms(),
            modelCalls: meta.modelCalls,
          });
          return json(response);
        } catch (e) {
          if (e instanceof HttpError && e.log)
            await record({
              ...base,
              ...e.log,
              message: e.message,
              latencyMs: ms(),
              modelCalls: null,
            });
          else if (!(e instanceof HttpError))
            await record({
              ...base,
              outcome: "error",
              reason: "internal",
              source: null,
              message: null,
              latencyMs: ms(),
              modelCalls: null,
            });
          throw e;
        }
      }

      // The view always renders; only changing it depends on availability.
      if (request.method === "POST" && !av.customize)
        throw new HttpError(403, av.message ?? DEFAULT_OFF_MESSAGE);

      switch (route) {
        case "GET ":
          return json(state(manifest, await load(manifest, ctx, av), av));
        case "POST proposals/:id/commit":
          return json(await commit(manifest, ctx, av, parts[3] as string));
        case "POST undo":
          return json(await undo(manifest, ctx, av));
        case "POST reset":
          return json(await reset(manifest, ctx, av));
        default:
          return json({ error: { message: "Not found" } }, 404);
      }
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { message: e.message } }, e.status);
      options.onError?.(e);
      return json({ error: { message: "Something went wrong." } }, 500);
    }
  };
}
