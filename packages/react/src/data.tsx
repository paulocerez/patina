import {
  type FieldDef,
  msg,
  type PublicCatalog,
  type Query,
  type QueryResult,
  runQuery,
  type SurfaceSpec,
  tx,
} from "@patina-ui/core";
import { createContext, useContext, useEffect, useState } from "react";
import { LocaleContext } from "./locale.js";

/**
 * Fetches rows for a catalog source. The default calls the source's GET endpoint with the
 * user's cookies. Pass your own to go through your data layer (React Query, auth headers…).
 */
export type FetchSource = (request: {
  source: string;
  path: string;
  params: Record<string, string>;
  signal: AbortSignal;
}) => Promise<unknown>;

export const defaultFetchSource: FetchSource = async ({ path, params, signal }) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(qs ? `${path}?${qs}` : path, { credentials: "same-origin", signal });
  if (!res.ok) throw new Error(`Couldn't load data (${res.status})`);
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) return body;
  for (const k of ["rows", "data", "items", "results"]) {
    const v = (body as Record<string, unknown> | null)?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
};

interface DataContextValue {
  fetchSource: FetchSource;
  cache: Map<string, { at: number; promise: Promise<unknown> }>;
}

export const DataContext = createContext<DataContextValue>({
  fetchSource: defaultFetchSource,
  cache: new Map(),
});

/** Set by <Surface> so blocks know which surface (and catalog) they belong to. */
export const SurfaceRenderContext = createContext<{
  spec: SurfaceSpec;
  catalog?: PublicCatalog;
} | null>(null);

/** Resolves param bindings ("filters.dateRange") against the current spec. */
export function bindParams(
  catalog: PublicCatalog,
  source: string,
  spec: SurfaceSpec,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, b] of Object.entries(catalog.sources[source]?.params ?? {})) {
    let v: unknown = b.value;
    if (b.from) {
      const [node, prop] = b.from.split(".") as [string, string];
      v = spec.nodes[node]?.props[prop];
    }
    if (v && typeof v === "object" && "relative" in v) v = (v as { relative: unknown }).relative;
    if (v !== undefined && v !== null && typeof v !== "object") out[name] = String(v);
  }
  return out;
}

export type QueryState =
  | { status: "loading" }
  | { status: "ready"; result: QueryResult }
  | { status: "error"; error: string }
  | { status: "unavailable" };

const TTL_MS = 10_000;

/**
 * Data for a block. Fetches the source through `fetchSource` (deduplicated and cached for
 * a few seconds) and evaluates the query in the browser. Use inside components rendered by
 * <Surface>.
 */
export function useQuery(query: Query | undefined): QueryState {
  const surface = useContext(SurfaceRenderContext);
  const { fetchSource, cache } = useContext(DataContext);
  const locale = useContext(LocaleContext);
  const catalog = surface?.catalog;
  const source = query ? catalog?.sources[query.source] : undefined;
  const params =
    source && surface && query
      ? bindParams(catalog as PublicCatalog, query.source, surface.spec)
      : {};
  const cacheKey =
    source && query ? `${query.source}?${new URLSearchParams(params).toString()}` : "";
  const queryKey = JSON.stringify(query ?? null);
  const [state, setState] = useState<QueryState>(
    source ? { status: "loading" } : { status: "unavailable" },
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by cacheKey/queryKey
  useEffect(() => {
    if (!source || !query || !catalog) {
      setState({ status: "unavailable" });
      return;
    }
    let live = true;
    const controller = new AbortController();
    let entry = cache.get(cacheKey);
    if (!entry || Date.now() - entry.at > TTL_MS) {
      entry = {
        at: Date.now(),
        promise: fetchSource({
          source: query.source,
          path: source.endpoint.path,
          params,
          signal: controller.signal,
        }),
      };
      cache.set(cacheKey, entry);
      entry.promise.catch(() => cache.delete(cacheKey));
    }
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    entry.promise.then(
      (rows) =>
        live && setState({ status: "ready", result: runQuery(catalog, query, rows, locale) }),
      (e) =>
        live && setState({ status: "error", error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [cacheKey, queryKey, catalog, fetchSource]);
  return state;
}

/** Formats a value for display according to its catalog field type. */
export function formatField(
  def: FieldDef | null | undefined,
  value: unknown,
  locale?: string,
): string {
  if (value === undefined || value === null || value === "") return "—";
  if (!def)
    return typeof value === "number"
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
      : String(value);
  switch (def.kind) {
    case "currency":
      return typeof value === "number"
        ? new Intl.NumberFormat(locale, {
            style: "currency",
            currency: def.currency ?? "USD",
            maximumFractionDigits: 0,
          }).format(value)
        : String(value);
    case "number":
      return typeof value === "number"
        ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
        : String(value);
    case "enum":
      return tx(def.valueLabels?.[String(value)], locale) ?? String(value);
    case "bool":
      return value ? msg(locale, "yes") : msg(locale, "no");
    default:
      return String(value);
  }
}
