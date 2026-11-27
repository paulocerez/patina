import {
  type CollectionItem,
  type SpecNode,
  type SurfaceSpec,
  USER_KEY_PREFIX,
} from "@patina-ui/core";
import { useContext, useSyncExternalStore } from "react";
import { Ctx } from "./context.js";
import type { SurfaceSnapshot } from "./store.js";

const noop = () => () => {};
const none = () => null;

/** The current spec (or preview), or null while loading or outside a `<PatinaProvider>`. */
function useSpec(surfaceId: string): SurfaceSpec | null {
  const ctx = useContext(Ctx);
  const store = ctx?.store(surfaceId);
  const snap = useSyncExternalStore<SurfaceSnapshot | null>(
    store?.subscribe ?? noop,
    store?.getSnapshot ?? none,
    store?.getSnapshot ?? none,
  );
  return snap?.spec ?? null;
}

/**
 * Keys your page knows but doesn't show until a user asks (e.g. an optional column). They
 * match the base spec's `hidden: true` items, and are left out of the fallback.
 */
export interface HookOptions<K extends string> {
  hidden?: readonly K[];
}

const shown = <K extends string>(fallback: readonly K[], o?: HookOptions<K>) =>
  o?.hidden?.length ? fallback.filter((k) => !o.hidden?.includes(k)) : [...fallback];
const knownKeys = <K extends string>(fallback: readonly K[], o?: HookOptions<K>) =>
  new Set<string>([...fallback, ...(o?.hidden ?? [])]);

function items(spec: SurfaceSpec | null, nodeId: string, prop: string): CollectionItem[] | null {
  const value = spec?.nodes[nodeId]?.props[prop];
  return Array.isArray(value) ? (value as CollectionItem[]) : null;
}

/**
 * The ordered, visible keys of a slot, for pages that keep their own JSX:
 *
 *   const sections = useSlot("dashboard", "overview", "sections", ["metrics", "chart", "calls"]);
 *   return <>{sections.map((key) => <Fragment key={key}>{SECTIONS[key]}</Fragment>)}</>;
 *
 * Returns `fallback` (your default order) while loading, without a `<PatinaProvider>` (e.g. when
 * customizing is behind a flag that's off) or if the node doesn't exist. Keys that aren't in
 * `fallback` are dropped, so the page only ever renders sections it knows.
 */
export function useSlot<K extends string>(
  surfaceId: string,
  nodeId: string,
  prop: string,
  fallback: readonly K[],
  options?: HookOptions<K>,
): K[] {
  const list = items(useSpec(surfaceId), nodeId, prop);
  if (!list) return shown(fallback, options);
  const known = knownKeys(fallback, options);
  return list.filter((it) => it && !it.hidden && known.has(it.key)).map((it) => it.key as K);
}

/**
 * The ordered, visible items of a collection prop (e.g. table columns or cards), each
 * `{ key, ...fields }`. Same fallback rules as `useSlot`. Optional columns the base spec hides
 * go in `options.hidden`: `useCollection("calls", "table", "columns", ["date", "status", "owner"], { hidden: ["owner"] })`.
 */
export function useCollection<K extends string>(
  surfaceId: string,
  nodeId: string,
  prop: string,
  fallback: readonly K[],
  options?: HookOptions<K>,
): (Record<string, unknown> & { key: K })[] {
  const list = items(useSpec(surfaceId), nodeId, prop);
  if (!list) return shown(fallback, options).map((key) => ({ key }));
  const known = knownKeys(fallback, options);
  return list
    .filter((it) => it && !it.hidden && known.has(it.key))
    .map(({ hidden: _h, ...rest }) => rest as Record<string, unknown> & { key: K });
}

/** One prop's current value (e.g. a default filter), or `fallback` until there is one. */
export function useSurfaceProp<T>(surfaceId: string, nodeId: string, prop: string, fallback: T): T {
  const value = useSpec(surfaceId)?.nodes[nodeId]?.props[prop];
  return value === undefined ? fallback : (value as T);
}

/** One entry of a slot: one of your own sections, or a block a user added. */
export type SlotItem<K extends string = string> =
  | { kind: "host"; key: K }
  | { kind: "block"; key: string; node: SpecNode };

/**
 * Like `useSlot`, plus the blocks users added (data views and your presets), in place:
 *
 *   useSlotItems("dashboard", "overview", "sections", SECTIONS).map((item) =>
 *     item.kind === "host"
 *       ? <Fragment key={item.key}>{blocks[item.key]}</Fragment>
 *       : <PatinaBlock key={item.key} surfaceId="dashboard" nodeId={item.key} components={DATA_BLOCKS} />)
 *
 * Your own keys still only appear if they're in `fallback`. Added blocks are recognizable by
 * their key (Patina gives every inserted node a `u_` key, which base items never use), so an
 * unknown key of yours is still dropped. Previews show new blocks in place.
 */
export function useSlotItems<K extends string>(
  surfaceId: string,
  nodeId: string,
  prop: string,
  fallback: readonly K[],
  options?: HookOptions<K>,
): SlotItem<K>[] {
  const spec = useSpec(surfaceId);
  const list = items(spec, nodeId, prop);
  if (!spec || !list) return shown(fallback, options).map((key) => ({ kind: "host", key }));
  const known = knownKeys(fallback, options);
  const out: SlotItem<K>[] = [];
  for (const it of list) {
    if (!it || it.hidden) continue;
    if (known.has(it.key)) out.push({ kind: "host", key: it.key as K });
    else if (it.key.startsWith(USER_KEY_PREFIX) && spec.nodes[it.key])
      out.push({ kind: "block", key: it.key, node: spec.nodes[it.key] as SpecNode });
  }
  return out;
}
