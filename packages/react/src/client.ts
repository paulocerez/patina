import type { ErrorBody, ProposeResponse, SurfaceState } from "@patina-ui/core";

export class PatinaRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PatinaRequestError";
  }
}

export interface PatinaClient {
  get(surfaceId: string): Promise<SurfaceState>;
  propose(surfaceId: string, prompt: string): Promise<ProposeResponse>;
  commit(surfaceId: string, proposalId: string): Promise<SurfaceState>;
  undo(surfaceId: string): Promise<SurfaceState>;
  reset(surfaceId: string): Promise<SurfaceState>;
}

export interface ClientOptions {
  /** Where the server handler is mounted, e.g. "/api/patina". */
  endpoint: string;
  /** Sent as `x-patina-locale`, so messages and previews come back in this language. */
  locale?: string;
  /** Custom fetch, e.g. to add auth headers. Defaults to the global fetch with cookies. */
  fetch?: typeof fetch;
}

/** A thin client for the `@patina-ui/server` routes. Holds no keys and no identity. */
export function createPatinaClient({
  endpoint,
  locale,
  fetch: f = (i, init) => fetch(i, { credentials: "same-origin", ...init }),
}: ClientOptions): PatinaClient {
  const base = endpoint.replace(/\/$/, "");
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await f(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(locale ? { "x-patina-locale": locale } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T | ErrorBody | null;
    if (!res.ok) {
      const message =
        (data as ErrorBody | null)?.error?.message ?? `Request failed (${res.status})`;
      throw new PatinaRequestError(res.status, message);
    }
    return data as T;
  }
  const s = (id: string) => `/surfaces/${encodeURIComponent(id)}`;
  return {
    get: (id) => call("GET", s(id)),
    propose: (id, prompt) => call("POST", `${s(id)}/proposals`, { prompt }),
    commit: (id, pid) => call("POST", `${s(id)}/proposals/${encodeURIComponent(pid)}/commit`),
    undo: (id) => call("POST", `${s(id)}/undo`),
    reset: (id) => call("POST", `${s(id)}/reset`),
  };
}
