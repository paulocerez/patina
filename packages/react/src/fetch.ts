import { asRelativeRange, rangeBounds } from "@patina-ui/core";
import type { FetchSource } from "./data.js";

/** How an endpoint pages through its rows. Pages are fetched one after another. */
export type Paging =
  /** `?limit=200&offset=400`; stops at a short page or at `total`. */
  | { style: "offset"; size: number; limit?: string; offset?: string; total?: string }
  /** `?page=3&pageSize=50`; `first` is the first page's number (default 1). */
  | { style: "page"; size: number; page?: string; pageSize?: string; first?: 0 | 1; total?: string }
  /** `?cursor=…`; the next cursor is read from `next` in the response ("nextCursor", "meta.next"). */
  | { style: "cursor"; cursor?: string; next: string; size?: number; limit?: string };

export interface DateRangeMapping {
  /** The catalog param holding a relative range ("thisWeek", "last30days"). Default "range". */
  param?: string;
  /** Query param names for the start and end the endpoint expects. */
  from: string;
  to: string;
  /** "iso" (default): full timestamps; "date": YYYY-MM-DD. */
  format?: "iso" | "date";
  /** Whether `to` is the last included moment/day (default) or the first excluded one. */
  toExclusive?: boolean;
  /** 1 (default): weeks start on Monday. */
  weekStartsOn?: 0 | 1;
}

export interface SourceOptions {
  /** Prepended to every path, e.g. "https://api.example.com". Default: same origin. */
  baseUrl?: string;
  /**
   * Sent with every request (e.g. the current tenant: `{ accountId }`). A path placeholder
   * with the same name (`/api/accounts/:accountId/orders`) is filled in instead.
   */
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string> | (() => Record<string, string>);
  credentials?: RequestCredentials;
  /** Where the rows are in the response: "items", "data.rows". Default: the body if it's an array, else rows/data/items/results. */
  rows?: string;
  paging?: Paging;
  /** Turns a relative range param into the endpoint's own start and end. */
  dateRange?: DateRangeMapping;
  /** Safety cap on pages per request. Default 50. */
  maxPages?: number;
}

export interface FetchSourceOptions extends SourceOptions {
  /** Per catalog source, merged over the options above. */
  sources?: Record<string, SourceOptions>;
  fetch?: typeof fetch;
  /** For tests. */
  now?: () => Date;
}

const get = (body: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined),
      body,
    );

function rowsOf(body: unknown, path?: string): unknown[] {
  if (path) {
    const v = get(body, path);
    if (Array.isArray(v)) return v;
    throw new Error(`Couldn't find rows at "${path}" in the response`);
  }
  if (Array.isArray(body)) return body;
  for (const k of ["rows", "data", "items", "results"]) {
    const v = (body as Record<string, unknown> | null)?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * A `fetchSource` for common APIs, configured instead of written: another origin, tenant
 * params, path placeholders, paging, rows inside an envelope and relative date ranges.
 *
 *   createFetchSource({
 *     baseUrl: import.meta.env.VITE_API_URL,
 *     credentials: "include",
 *     params: { accountId },
 *     sources: {
 *       orders: { rows: "items", paging: { style: "offset", size: 200, total: "total" },
 *                 dateRange: { from: "fromDate", to: "toDate" } },
 *     },
 *   })
 *
 * With paging, every page is fetched, so the source can be `complete: true`.
 */
export function createFetchSource(options: FetchSourceOptions = {}): FetchSource {
  const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return async ({ source, path, params, signal }) => {
    const o: SourceOptions = { ...options, ...options.sources?.[source] };
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...o.params, ...params }))
      if (v !== undefined && v !== null && v !== "") query[k] = String(v);

    let resolvedPath = path.replace(/:([A-Za-z_]\w*)/g, (_, name: string) => {
      const v = query[name];
      if (v === undefined) throw new Error(`No value for ":${name}" in ${path}`);
      delete query[name];
      return encodeURIComponent(v);
    });
    if (o.baseUrl) resolvedPath = `${o.baseUrl.replace(/\/$/, "")}${resolvedPath}`;

    const dr = o.dateRange;
    if (dr) {
      const name = dr.param ?? "range";
      const range = asRelativeRange(query[name]);
      if (range) {
        delete query[name];
        const { from, to } = rangeBounds(range, options.now?.() ?? new Date(), {
          weekStartsOn: dr.weekStartsOn ?? 1,
        });
        const end = dr.toExclusive
          ? to
          : new Date(to.getTime() - (dr.format === "date" ? 86_400_000 : 1));
        query[dr.from] = dr.format === "date" ? ymd(from) : from.toISOString();
        query[dr.to] = dr.format === "date" ? ymd(end) : end.toISOString();
      }
    }

    const headers = typeof o.headers === "function" ? o.headers() : o.headers;
    const page = async (extra: Record<string, string>) => {
      const qs = new URLSearchParams({ ...query, ...extra }).toString();
      const res = await doFetch(qs ? `${resolvedPath}?${qs}` : resolvedPath, {
        credentials: o.credentials ?? "same-origin",
        signal,
        ...(headers ? { headers } : {}),
      });
      if (!res.ok) throw new Error(`Couldn't load data (${res.status})`);
      return (await res.json()) as unknown;
    };

    const p = o.paging;
    if (!p) return rowsOf(await page({}), o.rows);

    const max = o.maxPages ?? 50;
    const all: unknown[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < max; i++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const extra: Record<string, string> =
        p.style === "offset"
          ? { [p.limit ?? "limit"]: String(p.size), [p.offset ?? "offset"]: String(i * p.size) }
          : p.style === "page"
            ? {
                [p.page ?? "page"]: String(i + (p.first ?? 1)),
                [p.pageSize ?? "pageSize"]: String(p.size),
              }
            : {
                ...(cursor ? { [p.cursor ?? "cursor"]: cursor } : {}),
                ...(p.size ? { [p.limit ?? "limit"]: String(p.size) } : {}),
              };
      const body = await page(extra);
      const rows = rowsOf(body, o.rows);
      all.push(...rows);
      if (p.style === "cursor") {
        const next = get(body, p.next);
        if (typeof next !== "string" || !next || rows.length === 0) return all;
        cursor = next;
        continue;
      }
      const total = p.total ? Number(get(body, p.total)) : Number.NaN;
      if (rows.length < p.size || (Number.isFinite(total) && all.length >= total)) return all;
    }
    throw new Error(`Stopped after ${max} pages; raise maxPages or narrow the range`);
  };
}
