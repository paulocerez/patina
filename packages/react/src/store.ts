import type {
  Capabilities,
  Notice,
  ProposeResponse,
  SurfaceSpec,
  SurfaceState,
} from "@patina-ui/core";
import { type ClarifyThread, type PatinaClient, PatinaRequestError } from "./client.js";

export type Proposal = Extract<ProposeResponse, { kind: "proposal" }>;

export type SurfaceStatus =
  | "loading"
  | "idle"
  | "proposing"
  | "previewing"
  | "committing"
  | "error";

export interface SurfaceSnapshot {
  status: SurfaceStatus;
  /** Last state from the server, or null while loading for the first time. */
  state: SurfaceState | null;
  /** The spec to render: the preview while one is pending, otherwise the saved spec. */
  spec: SurfaceSpec | null;
  proposal: Proposal | null;
  /**
   * What the last request said back, for the user to read: a refusal, a clarifying question
   * (with the options it offers), an answer to "what can I …?" (with the capabilities it
   * lists), an error, or "info" for a reply kind this version doesn't know.
   */
  message: SurfaceMessageData | null;
  /** Things this user asked for earlier that are now possible (from the last load). */
  notices: Notice[];
}

export interface SurfaceMessageData {
  kind: "refusal" | "clarify" | "answer" | "info" | "error";
  text: string;
  /** clarify: choices to offer (each is possible); picking one sends its label as the reply. */
  options?: { label: string }[];
  /** answer: what the user can change, narrowed to what they asked about. */
  capabilities?: Capabilities;
}

/** Framework-agnostic state for one surface. React subscribes via useSyncExternalStore. */
export class SurfaceStore {
  private snapshot: SurfaceSnapshot = {
    status: "loading",
    state: null,
    spec: null,
    proposal: null,
    message: null,
    notices: [],
  };
  private listeners = new Set<() => void>();
  private loaded = false;
  /** The question the next prompt answers (set by a clarify reply, used once). */
  private thread: ClarifyThread | null = null;

  constructor(
    private readonly client: PatinaClient,
    readonly surfaceId: string,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.loaded) {
      this.loaded = true;
      void this.reload();
    }
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(next: Partial<SurfaceSnapshot>) {
    const merged = { ...this.snapshot, ...next };
    merged.spec = merged.proposal?.previewSpec ?? merged.state?.spec ?? null;
    this.snapshot = merged;
    for (const l of this.listeners) l();
  }

  private async run(status: SurfaceStatus, work: () => Promise<Partial<SurfaceSnapshot>>) {
    this.set({ status, message: null });
    try {
      this.set({ status: "idle", ...(await work()) });
    } catch (e) {
      this.set({
        status: this.snapshot.state ? "idle" : "error",
        message: { kind: "error", text: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  reload = () =>
    this.run("loading", async () => {
      const state = await this.client.get(this.surfaceId);
      return { state, notices: state.notices ?? [] };
    });

  /** Hides a notice right away and tells the server, so it doesn't come back. */
  dismissNotice = async (key: string) => {
    this.set({ notices: this.snapshot.notices.filter((n) => n.key !== key) });
    await this.client.dismissNotice?.(this.surfaceId, key).catch(() => undefined);
  };

  /**
   * Asks for a change. Right after a clarifying question the prompt is sent as the reply to it
   * (with the question and the original request), once.
   */
  propose = (prompt: string) => {
    const thread = this.thread;
    this.thread = null;
    return this.run("proposing", async () => {
      const r = await this.client.propose(this.surfaceId, prompt, thread ?? undefined);
      if (r.kind === "proposal") return { proposal: r, status: "previewing" as const };
      if (r.kind === "clarify")
        this.thread = { prompt: thread?.prompt ?? prompt, question: r.question };
      return { proposal: null, message: toMessage(r) };
    });
  };

  /** True while a request runs: history actions are ignored then (no double undo). */
  private get busy() {
    const s = this.snapshot.status;
    return s === "loading" || s === "proposing" || s === "committing";
  }

  commit = () => {
    const p = this.snapshot.proposal;
    if (!p || this.busy) return Promise.resolve();
    return this.run("committing", async () => ({
      state: await this.client.commit(this.surfaceId, p.proposalId),
      proposal: null,
    }));
  };

  discard = () => {
    this.thread = null;
    this.set({ proposal: null, status: "idle", message: null });
  };

  undo = () => this.history((seq) => this.client.undo(this.surfaceId, seq));

  /** Takes back the last undo. */
  redo = () =>
    this.history((seq) => {
      if (!this.client.redo) throw new Error("This client doesn't support redo.");
      return this.client.redo(this.surfaceId, seq);
    });

  reset = () => this.history((seq) => this.client.reset(this.surfaceId, seq));

  /**
   * Undo, redo and reset: one at a time, and only for the history the user is looking at. If
   * it moved on (another tab, a click that was already sent), the server answers 409 and the
   * store shows the current state instead.
   */
  private history(action: (expectedSeq: number | undefined) => Promise<SurfaceState>) {
    if (this.busy) return Promise.resolve();
    this.thread = null;
    const seq = this.snapshot.state?.seq;
    return this.run("committing", async () => {
      try {
        return { state: await action(seq), proposal: null };
      } catch (e) {
        if (!(e instanceof PatinaRequestError) || e.status !== 409) throw e;
        const state = await this.client.get(this.surfaceId);
        return { state, proposal: null, message: { kind: "info" as const, text: e.message } };
      }
    });
  }
}

/** What to show for a reply that isn't a proposal. Unknown kinds show their `message`. */
function toMessage(r: ProposeResponse): SurfaceMessageData {
  const x = r as Record<string, unknown> & { kind: string };
  switch (r.kind) {
    case "refusal":
      return { kind: "refusal", text: r.message };
    case "clarify":
      return {
        kind: "clarify",
        text: r.question,
        ...(r.options?.length ? { options: r.options } : {}),
      };
    case "answer":
      return { kind: "answer", text: r.message, capabilities: r.capabilities };
    default: {
      const text =
        typeof x.message === "string"
          ? x.message
          : typeof x.question === "string"
            ? x.question
            : "";
      return { kind: "info", text };
    }
  }
}
