import {
  answerText,
  apply,
  buildModelRequest,
  type Capabilities,
  capabilities,
  capabilityHint,
  dataPresetIds,
  describe,
  effectivePatches,
  fieldPrivacy,
  fromModelOutput,
  headSeq,
  type Issue,
  identifierWords,
  isCapabilityQuestion,
  type Layer,
  localizeManifest,
  type Manifest,
  type ModelRefusalDetail,
  msg,
  nodeLabel,
  normalizeText,
  type Op,
  type ProposeResponse,
  pickLocale,
  publicCatalog,
  redoTarget,
  relevantOptions,
  removeNodes,
  rescueRefusal,
  resolve,
  restrictManifest,
  type SurfaceSpec,
  type SurfaceState,
  scopeCapabilities,
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
  type RequestDetail,
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
  /** The request's locale (see `locale` option). */
  locale: string;
  customize: boolean;
  dataViews: boolean;
  whenOff: "keep" | "base";
  message?: string;
}

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
  /**
   * The user's language for Patina's messages, previews and the model's replies. Default: the
   * `locale` query parameter (sent by <PatinaProvider locale>), the `x-patina-locale` header,
   * then Accept-Language, then English. Supported: en, de; host labels can be given per language.
   */
  locale?(ctx: NoInfer<Ctx>, request: Request): string | undefined | Promise<string | undefined>;
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
   * clarified, answered, unavailable, over_quota, error), why, the user's words (`prompt`), what
   * they were shown (`message`) and structured `detail`. Forward it to your analytics.
   * Errors thrown here are reported to onError and never affect the user.
   */
  onEvent?(event: RequestEvent): void | Promise<void>;
  /**
   * Store the request log through the storage adapter (if it supports it). Default true.
   * With `false` (or a storage adapter without a request log) no prompt is stored anywhere:
   * set `onEvent` to see what users ask for. The handler warns at startup if neither is on.
   */
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

const OUTCOMES = {
  proposal: "proposed",
  refusal: "refused",
  clarify: "clarified",
  answer: "answered",
} as const satisfies Record<ProposeResponse["kind"], RequestEvent["outcome"]>;

/** "short call duration" / "row_limit" → "shortCallDuration" / "rowLimit" (at most 40 chars). */
function slug(s: string): string {
  const words = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  return words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("")
    .slice(0, 40);
}

/** The parts of the page an answer covers (for the request log). */
function scopeOf(caps: Capabilities): string[] {
  return [...new Set([...caps.arrange.map((a) => a.node), ...caps.settings.map((x) => x.node)])];
}

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

  async function availabilityFor(
    ctx: Ctx,
    surfaceId: string,
    request: Request,
  ): Promise<Availability> {
    const rule = (await options.availability?.(ctx, surfaceId)) ?? {};
    const locale = pickLocale(
      (await options.locale?.(ctx, request)) ??
        new URL(request.url).searchParams.get("locale") ??
        request.headers.get("x-patina-locale") ??
        request.headers.get("accept-language"),
    );
    // A model that isn't set up (e.g. no API key in this environment) turns customizing off.
    const modelReady = options.model.available?.() ?? true;
    const customize = (rule.customize ?? true) && modelReady;
    const message = rule.message ?? (modelReady ? undefined : msg(locale, "notConfigured"));
    return {
      locale,
      customize,
      dataViews: customize && (rule.dataViews ?? true),
      whenOff: rule.whenOff ?? "keep",
      ...(message ? { message } : {}),
    };
  }

  async function checkQuota(ctx: Ctx, locale: string) {
    const q = options.limits?.monthlyProposals?.(ctx);
    const increment = options.storage.incrementUsage?.bind(options.storage);
    if (!q || !increment) return;
    const period = new Date().toISOString().slice(0, 7);
    const tenantId = ctx.tenantId ?? null;
    if (q.user !== undefined) {
      const n = await increment({ tenantId, subjectId: ctx.userId, period });
      if (n > q.user)
        throw new HttpError(429, msg(locale, "quotaUser", { max: q.user }), {
          outcome: "over_quota",
          reason: "quota_user",
          source: "host",
        });
    }
    if (q.tenant !== undefined && tenantId) {
      const n = await increment({ tenantId, subjectId: "*", period });
      if (n > q.tenant)
        throw new HttpError(429, msg(locale, "quotaTenant"), {
          outcome: "over_quota",
          reason: "quota_tenant",
          source: "host",
        });
    }
  }

  const logRequests = options.logRequests !== false && !!options.storage.logRequest;
  // Without the log or onEvent, nobody can see what users asked for (or what was refused).
  if (!logRequests && !options.onEvent)
    console.warn(
      "[patina] The request log is off (logRequests: false, or a storage adapter without logRequest such as postgresStorage({ requestLog: false })) and no onEvent is set: no prompt or refusal is recorded anywhere. Set onEvent to forward requests to your analytics.",
    );

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

  function rateLimit(ctx: Ctx, locale: string) {
    if (!perMinute) return;
    const k = `${ctx.tenantId ?? ""}:${ctx.userId}`;
    const now = Date.now();
    const times = (recent.get(k) ?? []).filter((t) => now - t < 60_000);
    if (times.length >= perMinute)
      throw new HttpError(429, msg(locale, "rateLimited"), {
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
    const m = restrictManifest(localizeManifest(manifest, av.locale), {
      ...((await manifest.restrict?.(ctx)) ?? {}),
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
      canRedo: av.customize && redoTarget(loaded.userEntries) !== null,
      seq: headSeq(loaded.userEntries),
      isCustomized: loaded.resolved.patchCount > 0,
      render: { slots, collections },
      ...(loaded.m.catalog ? { catalog: publicCatalog(loaded.m.catalog, av.locale) } : {}),
      ...(av.customize
        ? {
            capabilities: capabilities(loaded.me, loaded.resolved.spec, {
              dataViews: av.dataViews,
            }),
          }
        : {}),
      locale: av.locale,
      availability: {
        customize: av.customize,
        dataViews: av.dataViews,
        ...(!av.customize
          ? { message: av.message ?? msg(av.locale, "customizeOff") }
          : !av.dataViews
            ? { message: av.message ?? msg(av.locale, "dataViewsOff") }
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

  type Meta = {
    reason: string | null;
    source: RequestEvent["source"];
    modelCalls: number;
    detail?: RequestDetail | null;
  };
  type Loaded = Awaited<ReturnType<typeof load>>;
  type Thread = { prompt: string; question: string };

  /** Answers "what can I …?" from the manifest: the same data as `useCapabilities`, scoped. */
  function answer(loaded: Loaded, av: Availability, prompt: string, node: string | null) {
    const m = loaded.me;
    const spec = loaded.resolved.spec;
    const all = capabilities(m, spec, { dataViews: av.dataViews });
    const about =
      node && spec.nodes[node] ? `${prompt} ${nodeLabel(m, spec, node)} ${node}` : prompt;
    const { caps, scope } = scopeCapabilities(all, m, spec, about);
    const text = answerText(caps, scope, av.locale);
    const response: ProposeResponse = {
      kind: "answer",
      message: text,
      question: text,
      capabilities: caps,
    };
    return response;
  }

  /** The refusal's detail, checked against the manifest: real node, slug, catalog field. */
  function refusalDetail(
    manifest: Manifest<Ctx>,
    loaded: Loaded,
    d: ModelRefusalDetail | null | undefined,
  ): RequestDetail | null {
    if (!d) return null;
    const spec = loaded.resolved.spec;
    const node = d.node && spec.nodes[d.node] ? d.node : null;
    const wanted = d.wanted ? slug(d.wanted) : null;
    if (!node && !wanted) return null;
    let field: RequestDetail["field"] = null;
    if (wanted) {
      const w = normalizeText(identifierWords(wanted));
      for (const [sid, src] of Object.entries(manifest.catalog?.sources ?? {})) {
        for (const [fid, fd] of Object.entries(src.fields)) {
          if (normalizeText(identifierWords(fid)) !== w) continue;
          const visible = loaded.m.catalog?.sources[sid]?.fields[fid];
          const privacy = fieldPrivacy(fd);
          if (privacy === "never") field = { source: sid, field: fid, privacy: "never" };
          else if (!visible) field = { source: sid, field: fid, privacy: "restricted" };
          else if (privacy === "display") field = { source: sid, field: fid, privacy: "display" };
        }
      }
    }
    return {
      node,
      component: node ? (spec.nodes[node]?.component ?? null) : null,
      wanted,
      ...(field ? { field } : {}),
    };
  }

  async function propose(
    manifest: Manifest<Ctx>,
    ctx: Ctx,
    av: Availability,
    prompt: string,
    thread: Thread | null,
  ): Promise<{ response: ProposeResponse; meta: Meta }> {
    const L = av.locale;
    if (!prompt) throw new HttpError(400, msg(L, "typeSomething"));
    if (prompt.length > promptMaxChars)
      throw new HttpError(400, msg(L, "promptTooLong", { max: promptMaxChars }));

    const loaded = await load(manifest, ctx, av);
    const m = loaded.me;
    const spec = loaded.resolved.spec;
    const threadDetail = thread ? { thread } : {};
    const done = (
      response: ProposeResponse,
      reason: string | null,
      source: Meta["source"],
      modelCalls: number,
      detail: RequestDetail | null = null,
    ) => ({
      response,
      meta: {
        reason,
        source,
        modelCalls,
        detail: detail || thread ? { ...(detail ?? {}), ...threadDetail } : null,
      },
    });

    // "What can I show here?" is answered from the manifest: no model call, no quota.
    if (!thread && isCapabilityQuestion(prompt)) {
      const response = answer(loaded, av, prompt, null);
      return done(response, null, "host", 0, {
        scope: response.kind === "answer" ? scopeOf(response.capabilities) : [],
      });
    }

    rateLimit(ctx, L);
    await checkQuota(ctx, L);

    const request = buildModelRequest(m, spec, prompt, thread ? { thread } : {});
    // What the guard reads: a reply to a question only makes sense with the question's request.
    const fullPrompt = thread ? `${thread.prompt}\n${prompt}` : prompt;

    const save = async (ops: Op[], summary: string) => {
      const proposalId = newId("pr");
      await options.storage.saveProposal({
        id: proposalId,
        key: loaded.key,
        baseSeq: headSeq(loaded.userEntries),
        ops,
        summary,
        prompt,
        model: options.model.id,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      });
      const response: ProposeResponse = {
        kind: "proposal",
        proposalId,
        ops,
        changes: describe(m, spec, ops),
        summary,
        previewSpec: apply(m, spec, ops).spec,
      };
      return response;
    };

    /**
     * Every refusal passes here (except safety and the host's own rules): if the prompt names
     * something the manifest allows, propose it or ask which, instead of refusing.
     */
    const refuse = async (
      category: string,
      reason: string,
      source: Meta["source"],
      calls: number,
      modelDetail: ModelRefusalDetail | null = null,
    ) => {
      const detail = refusalDetail(manifest, loaded, modelDetail);
      const rescue = rescueRefusal(m, spec, fullPrompt, {
        category,
        message: reason,
        detail: modelDetail,
      });
      if (rescue?.kind === "patch")
        return done(
          await save(rescue.ops, rescue.summary),
          `rescued:${category}`,
          "guard",
          calls,
          detail,
        );
      // One clarification at most: a reply to a question doesn't get another one.
      if (rescue?.kind === "clarify" && !thread)
        return done(
          {
            kind: "clarify",
            question: rescue.question,
            options: rescue.options.map((o) => ({ label: o.label })),
          },
          `rescued:${category}`,
          "guard",
          calls,
          detail,
        );
      // Asked for something that isn't here: say what is, from the manifest, not the model.
      const hint =
        category === "data_access" || category === "not_on_page"
          ? capabilityHint(capabilities(m, spec, { dataViews: av.dataViews }), L, "data")
          : "";
      return done(
        { kind: "refusal", message: hint ? `${reason} ${hint}` : reason, category },
        category,
        source,
        calls,
        detail,
      );
    };

    let retryNote = "";
    let last:
      | { kind: "refusal"; category: string; reason: string; detail: ModelRefusalDetail | null }
      | { kind: "invalid"; issues: Issue[]; ops: Op[] }
      | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const calls = attempt + 1;
      const req = attempt === 0 ? request : { ...request, user: `${request.user}\n\n${retryNote}` };
      let raw: unknown;
      try {
        raw = await options.model.propose(req, { signal: AbortSignal.timeout(60_000), attempt });
      } catch (e) {
        if (e instanceof ModelRefusal)
          return done(
            {
              kind: "refusal",
              message: e.generic ? msg(L, "safetyDecline") : e.message,
              category: "safety",
            },
            "safety",
            "model",
            calls,
          );
        options.onError?.(e);
        throw new HttpError(502, msg(L, "modelUnavailable"), {
          outcome: "error",
          reason: "model_unavailable",
          source: null,
        });
      }
      let result = fromModelOutput(raw, undefined, L);
      // One clarification at most: the schema leaves "clarify" out for replies; if a model
      // asks anyway, it couldn't tell.
      if (result.kind === "clarify" && thread)
        result = { kind: "refusal", reason: result.question, category: "unclear", detail: null };

      if (result.kind === "answer") {
        const response = answer(loaded, av, prompt, result.detail?.node ?? null);
        return done(response, null, "model", calls, {
          scope: response.kind === "answer" ? scopeOf(response.capabilities) : [],
        });
      }

      if (result.kind === "refusal") {
        if (result.category === "safety")
          return done(
            { kind: "refusal", message: result.reason, category: "safety" },
            "safety",
            "model",
            calls,
          );
        last = {
          kind: "refusal",
          category: result.category,
          reason: result.reason,
          detail: result.detail,
        };
        // A second look, by the backup model, with the part of the manifest the refusal is about.
        retryNote = [
          "<previous_answer>",
          `refusal (${result.category}): ${JSON.stringify(result.reason)}`,
          "</previous_answer>",
          "<relevant_options>",
          relevantOptions(m, spec, fullPrompt, {
            category: result.category,
            message: result.reason,
            detail: result.detail,
          }),
          "</relevant_options>",
          "Check the request against these options again (labels are in the user's language). If it can be done with them, answer with a patch. Otherwise refuse with the most specific category and detail.",
        ].join("\n");
        continue;
      }

      if (result.kind === "clarify") {
        // Offer only options that are possible: each one's ops must validate.
        const problems: string[] = [];
        const valid = result.options.filter((o) => {
          if (o.ops.length === 0) {
            problems.push(`- option ${JSON.stringify(o.label)}: has no valid ops`);
            return false;
          }
          const issues = validate(m, spec, o.ops);
          if (issues.length)
            problems.push(`- option ${JSON.stringify(o.label)}: ${issues[0]?.message}`);
          return issues.length === 0;
        });
        if (valid.length)
          return done(
            {
              kind: "clarify",
              question: result.question,
              options: valid.map((o) => ({ label: o.label })),
            },
            null,
            "model",
            calls,
          );
        last = { kind: "refusal", category: "unclear", reason: result.question, detail: null };
        retryNote = `<problems_with_previous_answer>\nYou asked: ${JSON.stringify(result.question)}, but none of its options is possible:\n${problems.join("\n") || "- no options given"}\n</problems_with_previous_answer>\nAnswer with a patch if one reading is clearly meant, ask again offering only possible options (with their ops), or refuse.`;
        continue;
      }

      if (result.ops.length === 0) {
        last = {
          kind: "refusal",
          category: "no_change",
          reason: msg(L, "nothingToChange"),
          detail: null,
        };
        retryNote =
          "Your previous answer had no ops. Answer with the ops that do the request, or refuse with a category.";
        continue;
      }

      const issues = validate(m, spec, result.ops);
      if (issues.length === 0)
        return done(await save(result.ops, result.summary), null, null, calls);
      last = { kind: "invalid", issues, ops: result.ops };
      retryNote = `<problems_with_previous_answer>\n${issues.map((i) => `- op ${i.opIndex}: ${i.message}`).join("\n")}\n</problems_with_previous_answer>\nAnswer again, fixing these problems, or refuse if the request can't be done.`;
    }

    if (last?.kind === "refusal")
      return refuse(last.category, last.reason, "model", 2, last.detail);
    const issues = last?.issues ?? [];
    // Asked for a data view without access to data views: say why, not which op failed.
    if (!av.dataViews && touchesDataViews(loaded.m, spec, last?.ops ?? []))
      return done(
        { kind: "refusal", message: av.message ?? msg(L, "dataViewsOff") },
        "data_views_off",
        "host",
        2,
      );
    return refuse(
      issues[0]?.code ?? "not_possible",
      issues[0]?.message ?? msg(L, "notPossible"),
      "validator",
      2,
    );
  }

  async function commit(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability, proposalId: string) {
    const proposal = await options.storage.takeProposal(proposalId, keyFor(ctx, manifest.id));
    if (!proposal) throw new HttpError(409, msg(av.locale, "previewGone"));
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
    if (stale) throw new HttpError(409, msg(av.locale, "viewChanged"));
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

  /**
   * The client's history position must still be the head: a second click on Undo (sent before
   * the first one's answer arrived) gets 409 instead of undoing a step the user never saw.
   */
  function checkSeq(loaded: Loaded, expectedSeq: number | undefined, locale: string) {
    if (expectedSeq !== undefined && headSeq(loaded.userEntries) !== expectedSeq)
      throw new HttpError(409, msg(locale, "staleUndo"));
  }

  async function undo(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability, expectedSeq?: number) {
    const after = await appendWithRetry(manifest, ctx, av, (loaded) => {
      checkSeq(loaded, expectedSeq, av.locale);
      const target = undoTarget(loaded.userEntries);
      return target ? { kind: "revert", id: newId("r"), targetId: target.id } : null;
    });
    return state(manifest, after, av);
  }

  /** Takes back the last undo: appends a revert of that revert. */
  async function redo(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability, expectedSeq?: number) {
    const after = await appendWithRetry(manifest, ctx, av, (loaded) => {
      checkSeq(loaded, expectedSeq, av.locale);
      const target = redoTarget(loaded.userEntries);
      return target ? { kind: "revert", id: newId("r"), targetId: target.id } : null;
    });
    return state(manifest, after, av);
  }

  async function reset(manifest: Manifest<Ctx>, ctx: Ctx, av: Availability, expectedSeq?: number) {
    const after = await appendWithRetry(manifest, ctx, av, (loaded) => {
      checkSeq(loaded, expectedSeq, av.locale);
      // Only when the user's own layer changes anything: resetting a default view is a no-op.
      return effectivePatches(loaded.userEntries).length > 0
        ? { kind: "reset", id: newId("x") }
        : null;
    });
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

      const av = await availabilityFor(ctx, manifest.id, request);
      // Optional: clients before 0.7 send no body (some with a JSON content type).
      const expectedSeq = async () => {
        const b = (await body().catch(() => ({}))) as { expectedSeq?: unknown };
        return Number.isInteger(b?.expectedSeq) ? (b.expectedSeq as number) : undefined;
      };

      if (route === "POST proposals") {
        // Every customization request is logged with its outcome, including refusals.
        const started = performance.now();
        const b = (await body()) as { prompt?: unknown; thread?: unknown };
        const prompt = typeof b?.prompt === "string" ? b.prompt.trim() : "";
        // The question this prompt answers (sent by clients from 0.7). Only the user's own
        // words and Patina's question: nothing in it is trusted, the ops are still validated.
        const t = b?.thread as { prompt?: unknown; question?: unknown } | undefined;
        const thread =
          t && typeof t.prompt === "string" && typeof t.question === "string" && t.prompt.trim()
            ? {
                prompt: t.prompt.trim().slice(0, promptMaxChars),
                question: t.question.trim().slice(0, 1000),
              }
            : null;
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
            throw new HttpError(403, av.message ?? msg(av.locale, "customizeOff"), {
              outcome: "unavailable",
              reason: "customize_off",
              source: "host",
            });
          const { response, meta } = await propose(manifest, ctx, av, prompt, thread);
          await record({
            ...base,
            outcome: OUTCOMES[response.kind],
            reason: meta.reason,
            source: meta.source,
            message:
              response.kind === "refusal" || response.kind === "answer"
                ? response.message
                : response.kind === "clarify"
                  ? response.question
                  : null,
            detail: meta.detail ?? null,
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

      // Dismissing a notice is always allowed: it changes nothing on the page.
      const dismiss = route.match(/^POST notices\/([^/]+)\/dismiss$/);
      if (dismiss) {
        await options.storage.dismissNotice?.(
          { tenantId: ctx.tenantId ?? null, userId: ctx.userId, surfaceId: manifest.id },
          dismiss[1] as string,
        );
        return json({ ok: true });
      }

      // The view always renders; only changing it depends on availability.
      if (request.method === "POST" && !av.customize)
        throw new HttpError(403, av.message ?? msg(av.locale, "customizeOff"));

      switch (route) {
        case "GET ": {
          const st = state(manifest, await load(manifest, ctx, av), av);
          const notices = await options.storage
            .listNotices?.({
              tenantId: ctx.tenantId ?? null,
              userId: ctx.userId,
              surfaceId: manifest.id,
            })
            .catch((e: unknown) => {
              options.onError?.(e);
              return [];
            });
          return json(notices?.length ? { ...st, notices } : st);
        }
        case "POST proposals/:id/commit":
          return json(await commit(manifest, ctx, av, parts[3] as string));
        case "POST undo":
          return json(await undo(manifest, ctx, av, await expectedSeq()));
        case "POST redo":
          return json(await redo(manifest, ctx, av, await expectedSeq()));
        case "POST reset":
          return json(await reset(manifest, ctx, av, await expectedSeq()));
        default:
          return json({ error: { message: "Not found" } }, 404);
      }
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { message: e.message } }, e.status);
      options.onError?.(e);
      const locale = pickLocale(
        new URL(request.url).searchParams.get("locale") ??
          request.headers.get("x-patina-locale") ??
          request.headers.get("accept-language"),
      );
      return json({ error: { message: msg(locale, "somethingWrong") } }, 500);
    }
  };
}
