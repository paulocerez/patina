import type { Notice, ProposeResponse, SurfaceSpec, SurfaceState } from "@patina-ui/core";
import type { PatinaClient } from "./client.js";

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
  /** A refusal or clarifying question from the last request, for the user to read. */
  message: { kind: "refusal" | "clarify" | "error"; text: string } | null;
  /** Things this user asked for earlier that are now possible (from the last load). */
  notices: Notice[];
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

  propose = (prompt: string) =>
    this.run("proposing", async () => {
      const r = await this.client.propose(this.surfaceId, prompt);
      if (r.kind === "proposal") return { proposal: r, status: "previewing" as const };
      return {
        proposal: null,
        message:
          r.kind === "refusal"
            ? { kind: "refusal", text: r.message }
            : { kind: "clarify", text: r.question },
      };
    });

  commit = () => {
    const p = this.snapshot.proposal;
    if (!p) return Promise.resolve();
    return this.run("committing", async () => ({
      state: await this.client.commit(this.surfaceId, p.proposalId),
      proposal: null,
    }));
  };

  discard = () => this.set({ proposal: null, status: "idle", message: null });

  undo = () =>
    this.run("committing", async () => ({
      state: await this.client.undo(this.surfaceId),
      proposal: null,
    }));

  reset = () =>
    this.run("committing", async () => ({
      state: await this.client.reset(this.surfaceId),
      proposal: null,
    }));
}
