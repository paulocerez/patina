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
}

export function keyString(k: HistoryKey): string {
  return JSON.stringify([k.tenantId ?? "", k.layer, k.subjectId, k.surfaceId]);
}

/** In-process storage for tests, demos and prototypes. Data is lost on restart. */
export function memoryStorage(): StorageAdapter & {
  clear(): void;
  redactPrompts(before: Date): Promise<number>;
} {
  const histories = new Map<string, Entry[]>();
  const proposals = new Map<string, Proposal>();
  const usage = new Map<string, number>();
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
    async redactPrompts(before) {
      let n = 0;
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
    },
  };
}
