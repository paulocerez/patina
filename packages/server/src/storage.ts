import type { HistoryEntry, Op } from "@patina-ui/core";

/** Identifies one history: a layer (user or tenant) of one surface for one subject. */
export interface HistoryKey {
  tenantId: string | null;
  layer: "user" | "tenant";
  /** userId for the user layer, tenantId for the tenant layer. */
  subjectId: string;
  surfaceId: string;
}

/** A stored history entry: the core entry plus audit fields. */
export type Entry = HistoryEntry & {
  createdAt: string;
  /** For patches: the user's original prompt (may be cleared by retention). */
  prompt?: string | null;
  summary?: string | null;
  /** For patches: which model produced it, e.g. "anthropic/claude-opus-5-5". */
  model?: string | null;
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewEntry = DistributiveOmit<Entry, "seq" | "createdAt">;

/** A validated patch the user is previewing. Committed by ID, never re-sent by the client. */
export interface Proposal {
  id: string;
  key: HistoryKey;
  /** History head when the proposal was made. */
  baseSeq: number;
  ops: Op[];
  summary: string;
  prompt: string;
  model: string;
  expiresAt: string;
}

/** What happened to one customization request. */
export type RequestOutcome =
  | "proposed" // a valid change was previewed
  | "applied" // the user applied a previewed change
  | "refused" // it couldn't be done (see reason/source)
  | "clarified" // the model asked a question back
  | "unavailable" // the host's availability hook turned customizing off
  | "over_quota" // monthly quota or per-minute rate limit
  | "error"; // the model was unreachable, or something failed

/** One row of the request log: the record of what customers asked for and what happened. */
export interface RequestEvent {
  id: string;
  /** ISO timestamp. */
  at: string;
  surfaceId: string;
  userId: string;
  tenantId: string | null;
  /** The user's words. Cleared by `redactPrompts` after your retention period. */
  prompt: string | null;
  outcome: RequestOutcome;
  /**
   * Why, as a code. Refusals by the model use its category (data_access, action, new_component,
   * styling, not_on_page, unclear, other, safety, no_change); refusals by the validator use the
   * issue code (preset_not_allowed, not_customizable, …); the host's rules use customize_off,
   * data_views_off, quota_user, quota_tenant, rate_limit; errors use model_unavailable or internal.
   */
  reason: string | null;
  /** Who decided: the model, Patina's validator, or the host's own rules. */
  source: "model" | "validator" | "host" | null;
  /** What the user was shown. */
  message: string | null;
  proposalId: string | null;
  model: string | null;
  latencyMs: number | null;
  /** 2 means the model needed its one repair round-trip. */
  modelCalls: number | null;
}

export interface RequestFilter {
  since?: string;
  until?: string;
  tenantId?: string;
  surfaceId?: string;
  outcomes?: RequestOutcome[];
  /** Default 1000, at most 10 000. Newest first. */
  limit?: number;
}

export interface UsageKey {
  tenantId: string | null;
  subjectId: string;
  /** e.g. "2026-11" */
  period: string;
}

/** Thrown by `append` when another write got there first. */
export class ConflictError extends Error {
  constructor() {
    super("History changed concurrently");
    this.name = "ConflictError";
  }
}

export interface StorageAdapter {
  /** All entries of one history, ordered by seq. */
  list(key: HistoryKey): Promise<Entry[]>;
  /** Appends at `expectedSeq + 1`. Throws `ConflictError` if the head is no longer `expectedSeq`. */
  append(key: HistoryKey, entry: NewEntry, expectedSeq: number): Promise<Entry>;
  saveProposal(proposal: Proposal): Promise<void>;
  /** Returns and deletes a proposal, if it exists, belongs to `key` and has not expired. */
  takeProposal(id: string, key: HistoryKey): Promise<Proposal | null>;
  /**
   * Adds one to a usage counter and returns the new total. Needed only for the
   * `limits.monthlyProposals` quota. `subjectId` is a user id, or "*" for a whole tenant.
   */
  incrementUsage?(key: UsageKey): Promise<number>;
  /** Appends to the request log (see `RequestEvent`). Optional; enables insights. */
  logRequest?(event: RequestEvent): Promise<void>;
  /** Reads the request log, newest first. */
  listRequests?(filter: RequestFilter): Promise<RequestEvent[]>;
}

export function keyString(k: HistoryKey): string {
  return JSON.stringify([k.tenantId ?? "", k.layer, k.subjectId, k.surfaceId]);
}

/** In-process storage for tests, demos and prototypes. Data is lost on restart. */
export function memoryStorage(): StorageAdapter &
  Required<Pick<StorageAdapter, "incrementUsage" | "logRequest" | "listRequests">> & {
    clear(): void;
    redactPrompts(before: Date): Promise<number>;
  } {
  const histories = new Map<string, Entry[]>();
  const proposals = new Map<string, Proposal>();
  const usage = new Map<string, number>();
  const requests: RequestEvent[] = [];
  return {
    async list(key) {
      return structuredClone(histories.get(keyString(key)) ?? []);
    },
    async append(key, entry, expectedSeq) {
      const k = keyString(key);
      const list = histories.get(k) ?? [];
      const head = list.at(-1)?.seq ?? 0;
      if (head !== expectedSeq) throw new ConflictError();
      const stored = {
        ...structuredClone(entry),
        seq: head + 1,
        createdAt: new Date().toISOString(),
      } as Entry;
      histories.set(k, [...list, stored]);
      return structuredClone(stored);
    },
    async saveProposal(p) {
      proposals.set(p.id, structuredClone(p));
    },
    async takeProposal(id, key) {
      const p = proposals.get(id);
      if (!p || keyString(p.key) !== keyString(key)) return null;
      proposals.delete(id);
      return Date.parse(p.expiresAt) > Date.now() ? p : null;
    },
    async incrementUsage(k) {
      const id = JSON.stringify([k.tenantId ?? "", k.subjectId, k.period]);
      const n = (usage.get(id) ?? 0) + 1;
      usage.set(id, n);
      return n;
    },
    async logRequest(e) {
      requests.push(structuredClone(e));
    },
    async listRequests(f) {
      const limit = Math.min(f.limit ?? 1000, 10_000);
      return structuredClone(
        requests
          .filter(
            (e) =>
              (!f.since || e.at >= f.since) &&
              (!f.until || e.at < f.until) &&
              (!f.tenantId || e.tenantId === f.tenantId) &&
              (!f.surfaceId || e.surfaceId === f.surfaceId) &&
              (!f.outcomes || f.outcomes.includes(e.outcome)),
          )
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, limit),
      );
    },
    async redactPrompts(before) {
      let n = 0;
      for (const e of requests)
        if (e.prompt !== null && Date.parse(e.at) < before.getTime()) {
          e.prompt = null;
          n++;
        }
      for (const list of histories.values())
        for (const e of list)
          if (e.kind === "patch" && e.prompt && Date.parse(e.createdAt) < before.getTime()) {
            e.prompt = null;
            n++;
          }
      return n;
    },
    clear() {
      histories.clear();
      proposals.clear();
      usage.clear();
      requests.length = 0;
    },
  };
}
