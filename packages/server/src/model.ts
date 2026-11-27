import type { ModelRequest } from "@patina-ui/core";

/** A provider-agnostic model. Implementations return the raw JSON answer; Patina validates it. */
export interface ModelAdapter {
  /** e.g. "anthropic/claude-opus-5-5". Stored with each patch. */
  readonly id: string;
  /**
   * `attempt` is 0 for the first answer and 1 for the repair round-trip (when the first answer
   * didn't validate). Adapters may use it to route the retry elsewhere (see `withBackup`).
   */
  propose(
    request: ModelRequest,
    options?: { signal?: AbortSignal; attempt?: number },
  ): Promise<unknown>;
}

/**
 * Combines two models: `primary` answers first; `backup` takes over for the repair round-trip
 * (when the primary's answer didn't validate) and when the primary errors or declines.
 * Typical: a fast, cheap model first and a stronger one as backup.
 */
export function withBackup(primary: ModelAdapter, backup: ModelAdapter): ModelAdapter {
  return {
    id: `${primary.id}+${backup.id}`,
    async propose(request, options) {
      if ((options?.attempt ?? 0) > 0) return backup.propose(request, options);
      try {
        return await primary.propose(request, options);
      } catch (e) {
        if (options?.signal?.aborted) throw e;
        return backup.propose(request, options);
      }
    },
  };
}

/** Thrown by adapters when the provider declined or failed in a way the user should see as a refusal. */
export class ModelRefusal extends Error {
  /** True for a generic safety decline: Patina shows its own (localized) message instead. */
  readonly generic: boolean;
  constructor(message: string, options: { generic?: boolean } = {}) {
    super(message);
    this.name = "ModelRefusal";
    this.generic = options.generic ?? false;
  }
}
