import { type MessageKey, msg } from "@patina-ui/core";
import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { type ClientOptions, createPatinaClient, type PatinaClient } from "./client.js";
import { DataContext, defaultFetchSource, type FetchSource } from "./data.js";
import { LocaleContext } from "./locale.js";
import { type SurfaceSnapshot, SurfaceStore } from "./store.js";

interface PatinaContextValue {
  store(surfaceId: string): SurfaceStore;
}

export const Ctx = createContext<PatinaContextValue | null>(null);

export interface PatinaProviderProps extends Partial<ClientOptions> {
  /** Use a custom client instead of `endpoint`/`fetch` (e.g. in tests). */
  client?: PatinaClient;
  /** How data blocks load catalog sources. Defaults to a same-origin GET with cookies. */
  fetchSource?: FetchSource;
  /**
   * The user's language ("de", "de-DE", "en"…) for Patina's messages, previews and the model's
   * replies. Default: the browser's language. Supported: en, de (others fall back to English).
   */
  locale?: string;
  children: ReactNode;
}

/** Provides Patina to a subtree. Every `useSurface` for the same ID shares one store. */
export function PatinaProvider({
  endpoint = "/api/patina",
  fetch,
  credentials,
  params,
  client,
  fetchSource = defaultFetchSource,
  locale = defaultLocale(),
  children,
}: PatinaProviderProps) {
  const paramsKey = JSON.stringify(params ?? {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: params by value (paramsKey), so an inline object doesn't reset state
  const value = useMemo(() => {
    const c =
      client ??
      createPatinaClient({
        endpoint,
        locale,
        ...(credentials ? { credentials } : {}),
        ...(params ? { params } : {}),
        ...(fetch ? { fetch } : {}),
      });
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
  }, [endpoint, fetch, client, locale, credentials, paramsKey]);
  const data = useMemo(() => ({ fetchSource, cache: new Map() }), [fetchSource]);
  return (
    <Ctx.Provider value={value}>
      <LocaleContext.Provider value={locale}>
        <DataContext.Provider value={data}>{children}</DataContext.Provider>
      </LocaleContext.Provider>
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
  dismissNotice(key: string): Promise<void>;
  canUndo: boolean;
  isCustomized: boolean;
  /**
   * What this user may do (from the server's `availability` hook). Customizing defaults to
   * allowed while the first state is loading.
   */
  availability: { customize: boolean; dataViews: boolean; message?: string };
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
    dismissNotice: store.dismissNotice,
    canUndo: snap.state?.canUndo ?? false,
    isCustomized: snap.state?.isCustomized ?? false,
    availability: snap.state?.availability ?? { customize: true, dataViews: true },
    busy: snap.status === "loading" || snap.status === "proposing" || snap.status === "committing",
  };
}

function defaultLocale(): string {
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
}

/**
 * The provider's locale and Patina's own texts in it, for your components and generated
 * blocks: `const { locale, t } = usePatinaText(); t("loading")`.
 */
export function usePatinaText(): {
  locale: string;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
} {
  const locale = useContext(LocaleContext);
  return { locale, t: (key, params) => msg(locale, key, params) };
}
