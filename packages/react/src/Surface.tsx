import type { CollectionItem, SurfaceSpec, SurfaceState } from "@patina-ui/core";
import { type ComponentType, Fragment, type ReactNode } from "react";
import { useSurface } from "./context.js";
import { SurfaceRenderContext } from "./data.js";

// biome-ignore lint/suspicious/noExplicitAny: host components have arbitrary props
export type ComponentMap = Record<string, ComponentType<any>>;

export interface SurfaceProps {
  id: string;
  /** Host components, by the names used in the manifest. */
  components: ComponentMap;
  /** Rendered until the first spec arrives. */
  fallback?: ReactNode;
}

/**
 * Renders a surface from its resolved spec (or from the pending preview).
 *
 * Host components receive plain props: slot props arrive as ordered `ReactNode[]` with hidden
 * children removed, and collection props arrive as ordered arrays with hidden items removed.
 * Values are only ever passed as props; nothing is injected as HTML.
 */
export function Surface({ id, components, fallback = null }: SurfaceProps) {
  const { spec, state } = useSurface(id);
  if (!spec || !state) return <>{fallback}</>;
  return (
    <SurfaceRenderContext.Provider
      value={{ spec, ...(state.catalog ? { catalog: state.catalog } : {}) }}
    >
      {renderNode(spec, state.render, components, spec.root, new Set())}
    </SurfaceRenderContext.Provider>
  );
}

/** Renders one node (and its children) the way <Surface> does. */
export function renderNode(
  spec: SurfaceSpec,
  render: SurfaceState["render"],
  components: ComponentMap,
  nodeId: string,
  seen: Set<string>,
): ReactNode {
  const node = spec.nodes[nodeId];
  if (!node || seen.has(nodeId)) return null;
  const Component = components[node.component];
  if (!Component) {
    if (
      (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.NODE_ENV !==
      "production"
    )
      console.warn(`[patina] No component registered for "${node.component}"`);
    return null;
  }
  const path = new Set(seen).add(nodeId);
  const slots = render.slots[node.component] ?? [];
  const collections = render.collections[node.component] ?? [];
  const props: Record<string, unknown> = {};
  for (const [prop, value] of Object.entries(node.props)) {
    if (slots.includes(prop) && Array.isArray(value)) {
      props[prop] = visible(value).map((item) => (
        <Fragment key={item.key}>{renderNode(spec, render, components, item.key, path)}</Fragment>
      ));
    } else if (collections.includes(prop) && Array.isArray(value)) {
      props[prop] = visible(value).map(({ hidden: _h, ...rest }) => rest);
    } else {
      props[prop] = value;
    }
  }
  return <Component {...props} nodeId={nodeId} />;
}

function visible(list: unknown[]): CollectionItem[] {
  return (list as CollectionItem[]).filter((it) => it && !it.hidden);
}

export interface SurfaceScopeProps {
  surfaceId: string;
  children: ReactNode;
}

/**
 * Gives components outside <Surface> (on a page that renders itself) the surface's spec and
 * catalog, so `useQuery` and data blocks work there. <PatinaBlock> sets it for you.
 */
export function SurfaceScope({ surfaceId, children }: SurfaceScopeProps) {
  const { spec, state } = useSurface(surfaceId);
  if (!spec) return <>{children}</>;
  return (
    <SurfaceRenderContext.Provider
      value={{ spec, ...(state?.catalog ? { catalog: state.catalog } : {}) }}
    >
      {children}
    </SurfaceRenderContext.Provider>
  );
}

export interface PatinaBlockProps {
  surfaceId: string;
  /** The block's node ID: `item.key` from `useSlotItems`. */
  nodeId: string;
  /** Your block components, e.g. `{ PatinaTable, PatinaChart, PatinaStat }` from patina/blocks. */
  components: ComponentMap;
}

/**
 * Renders a block a user inserted (a data view, or one of your presets) on a page that
 * renders itself, with the data context its `useQuery` needs. Use it for the
 * `{ kind: "block" }` items from `useSlotItems`.
 */
export function PatinaBlock({ surfaceId, nodeId, components }: PatinaBlockProps) {
  const { spec, state } = useSurface(surfaceId);
  if (!spec || !state) return null;
  return (
    <SurfaceRenderContext.Provider
      value={{ spec, ...(state.catalog ? { catalog: state.catalog } : {}) }}
    >
      {renderNode(spec, state.render, components, nodeId, new Set())}
    </SurfaceRenderContext.Provider>
  );
}
