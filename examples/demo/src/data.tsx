import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/** Page-wide filters. Their initial values come from the FilterBar's (customizable) defaults. */
export interface Filters {
  range: string;
  status: string;
}

const FiltersCtx = createContext<{ filters: Filters; setFilters(f: Filters): void } | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({ range: "last30Days", status: "all" });
  return <FiltersCtx.Provider value={{ filters, setFilters }}>{children}</FiltersCtx.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersCtx);
  if (!ctx) throw new Error("useFilters outside FiltersProvider");
  return ctx;
}

const cache = new Map<string, Promise<unknown>>();

/** Minimal cached JSON fetch for the demo's data API (the host's own API, not Patina's). */
export function useJson<T>(url: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    let p = cache.get(url);
    if (!p) {
      p = fetch(url).then((r) => r.json());
      cache.set(url, p);
      setTimeout(() => cache.delete(url), 5_000);
    }
    p.then((d) => live && setData(d as T));
    return () => {
      live = false;
    };
  }, [url]);
  return data;
}

export interface Metrics {
  visits: number;
  noShows: number;
  revenue?: number;
  avgRevenue?: number;
  series?: { period: string; revenue: number }[];
}

export function useMetrics(groupBy = "week") {
  const { filters } = useFilters();
  return useJson<Metrics>(
    `/api/data/metrics?range=${filters.range}&status=${filters.status}&groupBy=${groupBy}`,
  );
}

export const euro = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
