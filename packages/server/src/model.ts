import type { ModelRequest } from "@patina-ui/core";

/** A provider-agnostic model. Implementations return the raw JSON answer; Patina validates it. */
export interface ModelAdapter {
  /** e.g. "anthropic/claude-opus-5-5". Stored with each patch. */
  readonly id: string;
  propose(request: ModelRequest, options?: { signal?: AbortSignal }): Promise<unknown>;
}

/** Thrown by adapters when the provider declined or failed in a way the user should see as a refusal. */
export class ModelRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRefusal";
  }
}
