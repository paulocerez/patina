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
  /** Hides a "now possible" notice for good. */
  dismissNotice?(surfaceId: string, key: string): Promise<void>;
}

export interface ClientOptions {
  /** Where the server handler is mounted, e.g. "/api/patina". */
  endpoint: string;
  /**
   * Sent as the `locale` query parameter, so messages and previews come back in this language.
   * (A query parameter, not a header, so cross-origin APIs need no CORS change.)
   */
  locale?: string;
  /**
   * Cookies: "same-origin" (default) or "include" when the API is on another origin
   * (e.g. app.example.com calling api.example.com).
   */
  credentials?: RequestCredentials;
  /** Extra query parameters on every request, e.g. `{ accountId }` for the server's getContext. */
  params?: Record<string, string>;
  /** Custom fetch, e.g. to add auth headers. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** A thin client for the `@patina-ui/server` routes. Holds no keys and no identity. */
export function createPatinaClient({
  endpoint,
  locale,
  credentials = "same-origin",
  params,
  fetch: f = (i, init) => fetch(i, init),
}: ClientOptions): PatinaClient {
  const base = endpoint.replace(/\/$/, "");
  const query = new URLSearchParams({ ...params, ...(locale ? { locale } : {}) }).toString();
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await f(`${base}${path}${query ? `?${query}` : ""}`, {
      method,
      credentials,
      headers: body === undefined ? {} : { "content-type": "application/json" },
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
    dismissNotice: async (id, key) => {
      await call("POST", `${s(id)}/notices/${encodeURIComponent(key)}/dismiss`);
    },
  };
}
