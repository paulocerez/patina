import type { CollectionItem, SurfaceSpec, SurfaceState } from "@patina/core";
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

function renderNode(
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
