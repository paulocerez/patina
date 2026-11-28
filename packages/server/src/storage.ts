import type { HistoryEntry, Notice, Op } from "@patina-ui/core";

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
  | "clarified" // the model (or the refusal guard) asked a question back
  | "answered" // the user asked what is possible and got the list (no change proposed)
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
   * Why, as a code. Refusals by the model use its category (missing_field, missing_setting,
   * missing_value, data_access, action, new_component, styling, not_on_page, unclear, other,
   * safety, no_change); proposals the refusal guard rescued use `rescued:<category>` (the model
   * refused something the manifest allows: add the prompt to your evals); refusals by the validator use the
   * issue code (preset_not_allowed, not_customizable, …); the host's rules use customize_off,
   * data_views_off, quota_user, quota_tenant, rate_limit; errors use model_unavailable or internal.
   */
  reason: string | null;
  /**
   * Who decided: the model, Patina's validator, the host's own rules, or the refusal guard (a
   * deterministic check that overrode a model refusal of something the manifest allows).
   */
  source: "model" | "validator" | "host" | "guard" | null;
  /** What the user was shown. */
  message: string | null;
  proposalId: string | null;
  model: string | null;
  latencyMs: number | null;
  /** 2 means the model needed its one retry (repair, or a second look at a refusal). */
  modelCalls: number | null;
  /**
   * Structured detail, for grouping and counting without reading prompts:
   * - refusals: `{ node, component, wanted, field? }` (e.g. node "recentCalls", wanted "summary";
   *   `field` when the catalog has the field but it is sensitive or restricted),
   * - replies to a clarifying question: `thread: { prompt, question }`,
   * - answers: `scope` (the parts of the page asked about).
   * Null when there is nothing to add. Older adapters may omit it.
   */
  detail?: RequestDetail | null;
}

/** See `RequestEvent.detail`. */
export interface RequestDetail {
  node?: string | null;
  component?: string | null;
  wanted?: string | null;
  field?: { source: string; field: string; privacy: "never" | "restricted" | "display" } | null;
  thread?: { prompt: string; question: string } | null;
  scope?: string[];
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
  /** Optional; enables "it's now possible" notices for shipped follow-ups. */
  linkFollowUp?: FollowUpLinks["linkFollowUp"];
  shipFollowUp?: FollowUpLinks["shipFollowUp"];
  listNotices?: FollowUpLinks["listNotices"];
  dismissNotice?: FollowUpLinks["dismissNotice"];
}

/** Who a follow-up notice is for: one user on one surface. */
export interface NoticeTarget {
  tenantId: string | null;
  userId: string;
  surfaceId: string;
}

/** Follow-ups and the users who asked for them, so they can be told when it ships. */
export interface FollowUpLinks {
  /** Records (or refreshes) who asked for a follow-up. Called by `runFollowUps` after delivery. */
  linkFollowUp(link: { key: string; title: string; requesters: NoticeTarget[] }): Promise<void>;
  /**
   * Marks a follow-up as shipped, so everyone who asked sees a notice on the surface where they
   * asked. Returns how many notices that makes. Idempotent.
   */
  shipFollowUp(key: string, message?: string | null): Promise<number>;
  /** Shipped, not yet dismissed notices for one user on one surface. */
  listNotices(who: NoticeTarget): Promise<Notice[]>;
  dismissNotice(who: NoticeTarget, key: string): Promise<void>;
}

export function keyString(k: HistoryKey): string {
  return JSON.stringify([k.tenantId ?? "", k.layer, k.subjectId, k.surfaceId]);
}

/**
 * Previews held in this process's memory (expired ones are dropped as new ones arrive).
 * For `postgresStorage({ previews: "memory" })` or your own adapter.
 */
export function memoryProposals(
  now: () => number = Date.now,
): Pick<StorageAdapter, "saveProposal" | "takeProposal"> {
  const previews = new Map<string, Proposal>();
  const expired = (p: Proposal) => Date.parse(p.expiresAt) <= now();
  return {
    async saveProposal(p) {
      for (const [id, old] of previews) if (expired(old)) previews.delete(id);
      previews.set(p.id, structuredClone(p));
    },
    async takeProposal(id, key) {
      const p = previews.get(id);
      if (!p || keyString(p.key) !== keyString(key)) return null;
      previews.delete(id);
      return expired(p) ? null : p;
    },
  };
}

/** In-process storage for tests, demos and prototypes. Data is lost on restart. */
export function memoryStorage(): StorageAdapter &
  Required<Pick<StorageAdapter, "incrementUsage" | "logRequest" | "listRequests">> &
  FollowUpLinks & {
    clear(): void;
    redactPrompts(before: Date): Promise<number>;
  } {
  const histories = new Map<string, Entry[]>();
  const proposals = new Map<string, Proposal>();
  const usage = new Map<string, number>();
  const requests: RequestEvent[] = [];
  type Link = NoticeTarget & {
    key: string;
    title: string;
    shippedAt: string | null;
    message: string | null;
    dismissedAt: string | null;
  };
  const links = new Map<string, Link>();
  const linkId = (key: string, w: NoticeTarget) =>
    JSON.stringify([key, w.tenantId ?? "", w.userId, w.surfaceId]);
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
    async linkFollowUp({ key, title, requesters }) {
      for (const r of requesters) {
        const id = linkId(key, r);
        const prev = links.get(id);
        links.set(id, {
          tenantId: r.tenantId,
          userId: r.userId,
          surfaceId: r.surfaceId,
          key,
          title,
          shippedAt: prev?.shippedAt ?? null,
          message: prev?.message ?? null,
          dismissedAt: prev?.dismissedAt ?? null,
        });
      }
      // Everyone linked to this follow-up sees the latest title.
      for (const l of links.values()) if (l.key === key) l.title = title;
    },
    async shipFollowUp(key, message = null) {
      let n = 0;
      const at = new Date().toISOString();
      for (const l of links.values())
        if (l.key === key) {
          if (!l.shippedAt) l.shippedAt = at;
          l.message = message;
          if (!l.dismissedAt) n++;
        }
      return n;
    },
    async listNotices(w) {
      return [...links.values()]
        .filter(
          (l) =>
            l.shippedAt &&
            !l.dismissedAt &&
            (l.tenantId ?? "") === (w.tenantId ?? "") &&
            l.userId === w.userId &&
            l.surfaceId === w.surfaceId,
        )
        .sort((a, b) => String(b.shippedAt).localeCompare(String(a.shippedAt)))
        .map((l) => ({
          key: l.key,
          title: l.title,
          message: l.message,
          shippedAt: l.shippedAt as string,
        }));
    },
    async dismissNotice(w, key) {
      const l = links.get(linkId(key, w));
      if (l) l.dismissedAt = new Date().toISOString();
    },
    clear() {
      links.clear();
      histories.clear();
      proposals.clear();
      usage.clear();
      requests.length = 0;
    },
  };
}
