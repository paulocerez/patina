import {
  apply,
  buildModelRequest,
  describe,
  fromModelOutput,
  headSeq,
  type Issue,
  type Layer,
  type Manifest,
  type ProposeResponse,
  publicCatalog,
  resolve,
  restrictManifest,
  type SurfaceState,
  undoTarget,
  validate,
} from "@patina/core";
import { type ModelAdapter, ModelRefusal } from "./model.js";
import {
  ConflictError,
  type Entry,
  type HistoryKey,
  type NewEntry,
  type StorageAdapter,
} from "./storage.js";

/** What the host knows about the caller. Always derived from the host's own session. */
export interface PatinaContext {
  userId: string;
  tenantId?: string | null;
  /** Checked against catalog `requires` (fields and sources). */
  permissions?: string[];
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
  limits?: {
    /** Default 500. */
    promptMaxChars?: number;
    /** Default 10 per user per minute. 0 disables the limit. */
    proposalsPerMinute?: number;
    /** How long a preview can be committed. Default 900 s. */
    proposalTtlSeconds?: number;
  };
  /** Called with unexpected errors (they are returned to the client as a generic 500). */
  onError?(error: unknown): void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
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
 * `toExpress` from "@patina/server/express".
 */
export function createPatinaHandler<Ctx extends PatinaContext>(options: PatinaHandlerOptions<Ctx>) {
  const surfaces = new Map(options.surfaces.map((s) => [s.id, s]));
  const basePath = (options.basePath ?? "").replace(/\/$/, "");
  const promptMaxChars = options.limits?.promptMaxChars ?? 500;
  const perMinute = options.limits?.proposalsPerMinute ?? 10;
  const ttl = options.limits?.proposalTtlSeconds ?? 900;
  const recent = new Map<string, number[]>();

  function rateLimit(ctx: Ctx) {
    if (!perMinute) return;
    const k = `${ctx.tenantId ?? ""}:${ctx.userId}`;
    const now = Date.now();
    const times = (recent.get(k) ?? []).filter((t) => now - t < 60_000);
    if (times.length >= perMinute)
      throw new HttpError(429, "That's a lot of changes at once. Try again in a minute.");
    times.push(now);
    recent.set(k, times);
  }

  function keyFor(ctx: Ctx, surfaceId: string): HistoryKey {
    return { tenantId: ctx.tenantId ?? null, layer: "user", subjectId: ctx.userId, surfaceId };
  }

  async function load(manifest: Manifest<Ctx>, ctx: Ctx) {
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
    const layers: Layer[] = [
      { name: "tenant", entries: tenantEntries },
      { name: "user", entries: userEntries },
    ];
    const resolved = resolve(m as Manifest<unknown>, layers);
    return { m: m as Manifest<unknown>, key, userEntries, resolved };
  }

  function state(manifest: Manifest<Ctx>, loaded: Awaited<ReturnType<typeof load>>): SurfaceState {
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
      canUndo: undoTarget(loaded.userEntries) !== null,
      isCustomized: loaded.resolved.patchCount > 0,
      render: { slots, collections },
      ...(loaded.m.catalog ? { catalog: publicCatalog(loaded.m.catalog) } : {}),
    };
  }

  async function appendWithRetry(
    manifest: Manifest<Ctx>,
    ctx: Ctx,
    build: (loaded: Awaited<ReturnType<typeof load>>) => NewEntry | null,
  ) {
    for (let attempt = 0; ; attempt++) {
      const loaded = await load(manifest, ctx);
      const entry = build(loaded);
      if (!entry) return loaded;
      try {
        await options.storage.append(loaded.key, entry, headSeq(loaded.userEntries));
        return load(manifest, ctx);
      } catch (e) {
        if (!(e instanceof ConflictError) || attempt >= 2) throw e;
      }
    }
  }

  async function propose(
    manifest: Manifest<Ctx>,
    ctx: Ctx,
    body: unknown,
  ): Promise<ProposeResponse> {
    const prompt =
      typeof (body as { prompt?: unknown })?.prompt === "string"
        ? (body as { prompt: string }).prompt.trim()
        : "";
    if (!prompt) throw new HttpError(400, "Type what you'd like to change.");
    if (prompt.length > promptMaxChars)
      throw new HttpError(400, `Please keep requests under ${promptMaxChars} characters.`);
    rateLimit(ctx);

    const loaded = await load(manifest, ctx);
    const { m } = loaded;
    const spec = loaded.resolved.spec;
    const request = buildModelRequest(m, spec, prompt);

    let issues: Issue[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
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
        if (e instanceof ModelRefusal) return { kind: "refusal", message: e.message };
        options.onError?.(e);
        throw new HttpError(502, "The assistant is unavailable right now. Please try again.");
      }
      const result = fromModelOutput(raw);
      if (result.kind === "refusal") return { kind: "refusal", message: result.reason };
      if (result.kind === "clarify") return { kind: "clarify", question: result.question };
      if (result.ops.length === 0)
        return {
          kind: "refusal",
          message: "I couldn't find anything on this page to change for that request.",
        };

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
        return {
          kind: "proposal",
          proposalId,
          ops: result.ops,
          changes: describe(m, spec, result.ops),
          summary: result.summary,
          previewSpec: apply(m, spec, result.ops).spec,
        };
      }
    }
    return { kind: "refusal", message: issues[0]?.message ?? "That change isn't possible here." };
  }

  async function commit(manifest: Manifest<Ctx>, ctx: Ctx, proposalId: string) {
    const proposal = await options.storage.takeProposal(proposalId, keyFor(ctx, manifest.id));
    if (!proposal) throw new HttpError(409, "This preview has expired. Please ask again.");
    let stale = false;
    const after = await appendWithRetry(manifest, ctx, (loaded) => {
      if (validate(loaded.m, loaded.resolved.spec, proposal.ops).length > 0) {
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
    return state(manifest, after);
  }

  async function undo(manifest: Manifest<Ctx>, ctx: Ctx) {
    const after = await appendWithRetry(manifest, ctx, (loaded) => {
      const target = undoTarget(loaded.userEntries);
      return target ? { kind: "revert", id: newId("r"), targetId: target.id } : null;
    });
    return state(manifest, after);
  }

  async function reset(manifest: Manifest<Ctx>, ctx: Ctx) {
    const after = await appendWithRetry(manifest, ctx, (loaded) =>
      loaded.resolved.patchCount > 0 || loaded.userEntries.length > 0
        ? { kind: "reset", id: newId("x") }
        : null,
    );
    return state(manifest, after);
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

      switch (route) {
        case "GET ":
          return json(state(manifest, await load(manifest, ctx)));
        case "POST proposals":
          return json(await propose(manifest, ctx, await body()));
        case "POST proposals/:id/commit":
          return json(await commit(manifest, ctx, parts[3] as string));
        case "POST undo":
          return json(await undo(manifest, ctx));
        case "POST reset":
          return json(await reset(manifest, ctx));
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
