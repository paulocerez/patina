import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { type ClientOptions, createPatinaClient, type PatinaClient } from "./client.js";
import { DataContext, defaultFetchSource, type FetchSource } from "./data.js";
import { type SurfaceSnapshot, SurfaceStore } from "./store.js";

interface PatinaContextValue {
  store(surfaceId: string): SurfaceStore;
}

const Ctx = createContext<PatinaContextValue | null>(null);

export interface PatinaProviderProps extends Partial<ClientOptions> {
  /** Use a custom client instead of `endpoint`/`fetch` (e.g. in tests). */
  client?: PatinaClient;
  /** How data blocks load catalog sources. Defaults to a same-origin GET with cookies. */
  fetchSource?: FetchSource;
  children: ReactNode;
}

/** Provides Patina to a subtree. Every `useSurface` for the same ID shares one store. */
export function PatinaProvider({
  endpoint = "/api/patina",
  fetch,
  client,
  fetchSource = defaultFetchSource,
  children,
}: PatinaProviderProps) {
  const value = useMemo(() => {
    const c = client ?? createPatinaClient({ endpoint, ...(fetch ? { fetch } : {}) });
    const stores = new Map<string, SurfaceStore>();
    return {
      store(id: string) {
        const existing = stores.get(id);
        if (existing) return existing;
        const created = new SurfaceStore(c, id);
        stores.set(id, created);
        return created;
      },
    };
  }, [endpoint, fetch, client]);
  const data = useMemo(() => ({ fetchSource, cache: new Map() }), [fetchSource]);
  return (
    <Ctx.Provider value={value}>
      <DataContext.Provider value={data}>{children}</DataContext.Provider>
    </Ctx.Provider>
  );
}

export interface UseSurface extends SurfaceSnapshot {
  propose(prompt: string): Promise<void>;
  commit(): Promise<void>;
  discard(): void;
  undo(): Promise<void>;
  reset(): Promise<void>;
  reload(): Promise<void>;
  canUndo: boolean;
  isCustomized: boolean;
  busy: boolean;
}

/** State and actions for one customizable surface. */
export function useSurface(surfaceId: string): UseSurface {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSurface must be used inside <PatinaProvider>");
  const store = ctx.store(surfaceId);
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    ...snap,
    propose: store.propose,
    commit: store.commit,
    discard: store.discard,
    undo: store.undo,
    reset: store.reset,
    reload: store.reload,
    canUndo: snap.state?.canUndo ?? false,
    isCustomized: snap.state?.isCustomized ?? false,
    busy: snap.status === "loading" || snap.status === "proposing" || snap.status === "committing",
  };
}
