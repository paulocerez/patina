import { type CollectionDef, humanize, isListType, type SlotDef, type TypeDef } from "./dsl.js";
import { msg, tx } from "./i18n.js";
import { type Manifest, nodeLabel } from "./manifest.js";
import type {
  Anchor,
  CollectionItem,
  Issue,
  IssueCode,
  NodeId,
  Op,
  Patch,
  Path,
  Skip,
  SpecNode,
  SurfaceSpec,
  Value,
} from "./types.js";
import { checkValue, formatValue } from "./values.js";

/** Prefix of keys and node IDs created by user inserts. Base items never use it. */
export const USER_KEY_PREFIX = "u_";

export type ApplyMode = "strict" | "tolerant";

export interface ApplyResult {
  spec: SurfaceSpec;
  applied: Op[];
  /** Ops that could not be applied, with readable reasons. */
  skipped: Skip[];
}

type StepResult = { ok: true; spec: SurfaceSpec } | { ok: false; code: IssueCode; message: string };

// ───────────────────────────────── apply ──────────────────────────────────

/**
 * Applies a patch.
 *
 * - `strict` (authoring, commit): if any op is invalid, nothing is applied and every
 *   problem is reported in `skipped`.
 * - `tolerant` (replay): invalid ops are skipped and reported; the rest apply.
 *
 * Never throws, whatever the input.
 */
export function apply(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  patch: Pick<Patch, "ops"> | Op[],
  mode: ApplyMode = "strict",
): ApplyResult {
  const ops: unknown[] = Array.isArray(patch) ? patch : Array.isArray(patch?.ops) ? patch.ops : [];
  let current = spec;
  const applied: Op[] = [];
  const skipped: Skip[] = [];
  ops.forEach((raw, opIndex) => {
    const op = parseOp(raw);
    if (!op) {
      skipped.push({
        opIndex,
        op: raw as Op,
        code: "malformed_op",
        message: msg(m.locale, "malformedOp"),
      });
      return;
    }
    let r: StepResult;
    try {
      r = step(m, current, op);
    } catch {
      r = { ok: false, code: "malformed_op", message: msg(m.locale, "notApplied") };
    }
    if (r.ok) {
      current = r.spec;
      applied.push(op);
    } else {
      skipped.push({ opIndex, op, code: r.code, message: r.message });
    }
  });
  if (mode === "strict" && skipped.length > 0) return { spec, applied: [], skipped };
  return { spec: current, applied, skipped };
}

/** Validates a patch against the manifest and the spec it will apply to. */
export function validate(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  patch: Pick<Patch, "ops"> | Op[],
): Issue[] {
  return apply(m, spec, patch, "strict").skipped.map(({ opIndex, code, message }) => ({
    opIndex,
    code,
    message,
  }));
}

function fail(code: IssueCode, message: string): StepResult {
  return { ok: false, code, message };
}

interface Target {
  node: SpecNode;
  def: TypeDef;
  name: string;
}

function resolveTarget(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  nodeId: NodeId,
  prop: string,
): Target | StepResult {
  const node = spec.nodes[nodeId];
  if (!node) return fail("unknown_node", msg(m.locale, "unknownNode", { id: nodeId }));
  const name = nodeLabel(m, spec, nodeId);
  const comp = m.components[node.component];
  const def = comp?.props[prop];
  if (!def) {
    return prop in node.props
      ? fail(
          "not_customizable",
          msg(m.locale, "propNotCustomizable", { prop: humanize(prop), name }),
        )
      : fail("unknown_prop", msg(m.locale, "noSuchSetting", { name, setting: prop }));
  }
  return { node, def, name };
}

function isTarget(x: Target | StepResult): x is Target {
  return "def" in x;
}

function listOfNode(node: SpecNode, prop: string): CollectionItem[] {
  const v = node.props[prop];
  return Array.isArray(v) ? (v as unknown as CollectionItem[]) : [];
}

/** “English” or „German“ quotes. */
function quote(text: string, locale?: string): string {
  return locale?.toLowerCase().startsWith("de") ? `„${text}“` : `“${text}”`;
}

function itemLabel(
  m: Manifest<unknown>,
  spec: SurfaceSpec,
  def: CollectionDef | SlotDef,
  key: string,
): string {
  if (def.kind === "slot") return nodeLabel(m, spec, key);
  return quote(tx(def.labels?.[key], m.locale) ?? humanize(key), m.locale);
}

function withProps(spec: SurfaceSpec, nodeId: NodeId, props: Record<string, Value>): SurfaceSpec {
  const node = spec.nodes[nodeId] as SpecNode;
  return { ...spec, nodes: { ...spec.nodes, [nodeId]: { ...node, props } } };
}

function anchorIndex(list: CollectionItem[], to: Anchor, self: string): number | null {
  if (to === "start") return 0;
  if (to === "end") return list.length;
  const ref = "before" in to ? to.before : to.after;
  if (ref === self) return null;
  const i = list.findIndex((it) => it.key === ref);
  if (i < 0) return null;
  return "before" in to ? i : i + 1;
}

function anchorRef(to: Anchor): string | null {
  if (typeof to === "string") return null;
  return "before" in to ? to.before : to.after;
}

function step(m: Manifest<unknown>, spec: SurfaceSpec, op: Op): StepResult {
  const prop = op.op === "set" ? op.path[0] : op.prop;
  const target = resolveTarget(m, spec, op.node, prop);
  if (!isTarget(target)) return target;
  const { node, def, name } = target;
  const L = m.locale;

  switch (op.op) {
    case "set": {
      if (op.path.length === 1) {
        if (isListType(def))
          return fail(
            "not_customizable",
            msg(L, "propNotReplaceable", { prop: humanize(prop), name }),
          );
        const err = checkValue(def, op.value, L);
        if (err)
          return fail(
            "invalid_value",
            def.kind === "query"
              ? msg(L, "queryInvalid", { name, error: err })
              : msg(L, "propInvalid", { prop: tx(def.label, L) ?? humanize(prop), error: err }),
          );
        const props = { ...node.props };
        if (op.value === null) delete props[prop];
        else props[prop] = op.value;
        return { ok: true, spec: withProps(spec, op.node, props) };
      }
      const [, key, field] = op.path;
      if (!isListType(def))
        return fail("unknown_field", msg(L, "noItems", { prop: humanize(prop), name }));
      const list = listOfNode(node, prop);
      const idx = list.findIndex((it) => it.key === key);
      if (idx < 0) return fail("unknown_key", msg(L, "noSuchItem", { name, item: humanize(key) }));
      const label = itemLabel(m, spec, def, key);
      if (field === "key") return fail("unknown_field", msg(L, "keyFixed", { item: label }));
      if (field === "hidden") {
        if (!def.hide) return fail("not_hideable", msg(L, "notHideable", { item: label }));
        if (op.value !== null && typeof op.value !== "boolean")
          return fail("invalid_value", msg(L, "hiddenOnOff"));
      } else {
        const fdef = def.kind === "collection" ? def.item[field] : undefined;
        if (!fdef)
          return fail("unknown_field", msg(L, "noSuchSetting", { name: label, setting: field }));
        const err = checkValue(fdef, op.value, L);
        if (err)
          return fail(
            "invalid_value",
            msg(L, "fieldInvalid", {
              field: tx(fdef.label, L) ?? humanize(field),
              item: label,
              error: err,
            }),
          );
      }
      const item = { ...(list[idx] as CollectionItem) };
      if (op.value === null) delete item[field];
      else item[field] = op.value;
      const next = list.slice();
      next[idx] = item;
      return {
        ok: true,
        spec: withProps(spec, op.node, { ...node.props, [prop]: next as unknown as Value }),
      };
    }

    case "move": {
      if (!isListType(def))
        return fail("not_reorderable", msg(L, "noOrder", { prop: humanize(prop), name }));
      if (!def.reorder)
        return fail("not_reorderable", msg(L, "orderFixed", { prop: humanize(prop), name }));
      const list = listOfNode(node, prop);
      const from = list.findIndex((it) => it.key === op.key);
      if (from < 0)
        return fail("unknown_key", msg(L, "noSuchItem", { name, item: humanize(op.key) }));
      const item = list[from] as CollectionItem;
      const rest = list.filter((_, i) => i !== from);
      const at = anchorIndex(rest, op.to, op.key);
      if (at === null)
        return fail(
          "unknown_anchor",
          msg(L, "cantPlace", {
            item: itemLabel(m, spec, def, op.key),
            anchor: String(anchorRef(op.to)),
          }),
        );
      rest.splice(at, 0, item);
      return {
        ok: true,
        spec: withProps(spec, op.node, { ...node.props, [prop]: rest as unknown as Value }),
      };
    }

    case "insert": {
      const preset = m.presets[op.preset];
      const allowed = def.kind === "slot" ? def.insert : [];
      if (!preset || !allowed.includes(op.preset)) {
        const options = allowed.map((p) => tx(m.presets[p]?.label, L)).filter(Boolean);
        const what =
          tx(preset?.label, L) ??
          (L?.startsWith("de") ? `„${humanize(op.preset)}“` : `“${humanize(op.preset)}”`);
        return fail(
          "preset_not_allowed",
          msg(L, "cantAdd", { preset: what }) +
            (options.length ? msg(L, "youCanAdd", { options: options.join(", ") }) : ""),
        );
      }
      const presetLabel = tx(preset.label, L) ?? op.preset;
      if (def.kind !== "slot" || !def.accepts.includes(preset.node.component))
        return fail("preset_not_allowed", msg(L, "cantGoIn", { preset: presetLabel, name }));
      if (!op.key.startsWith(USER_KEY_PREFIX) || op.key.length > 64)
        return fail("malformed_op", msg(L, "newKeyPrefix", { prefix: USER_KEY_PREFIX }));
      const list = listOfNode(node, prop);
      if (spec.nodes[op.key] || list.some((it) => it.key === op.key))
        return fail("duplicate_key", msg(L, "duplicateKey", { key: op.key }));
      const at = anchorIndex(list, op.to, op.key);
      if (at === null)
        return fail(
          "unknown_anchor",
          msg(L, "cantPlace", { item: presetLabel, anchor: String(anchorRef(op.to)) }),
        );
      const props = structuredClone(preset.node.props);
      const comp = m.components[preset.node.component];
      for (const [k, v] of Object.entries(op.props ?? {})) {
        const pdef = comp?.props[k];
        if (!pdef || isListType(pdef))
          return fail(
            "not_customizable",
            msg(L, "presetNoSetting", { preset: presetLabel, setting: k }),
          );
        const err = checkValue(pdef, v, L);
        if (err)
          return fail(
            "invalid_value",
            pdef.kind === "query"
              ? msg(L, "newQueryInvalid", {
                  preset: L?.startsWith("de") ? presetLabel : presetLabel.toLowerCase(),
                  error: err,
                })
              : msg(L, "fieldInvalid", {
                  field: tx(pdef.label, L) ?? humanize(k),
                  item: presetLabel,
                  error: err,
                }),
          );
        if (v === null) delete props[k];
        else props[k] = v;
      }
      const next = list.slice();
      next.splice(at, 0, { key: op.key });
      const created: SpecNode = { component: preset.node.component, props, preset: op.preset };
      const withNode = { ...spec, nodes: { ...spec.nodes, [op.key]: created } };
      return {
        ok: true,
        spec: withProps(withNode, op.node, { ...node.props, [prop]: next as unknown as Value }),
      };
    }

    case "remove": {
      if (def.kind !== "slot") return fail("cannot_remove_base_item", msg(L, "onlyHide", { name }));
      const list = listOfNode(node, prop);
      if (!list.some((it) => it.key === op.key))
        return fail("unknown_key", msg(L, "noSuchItem", { name, item: humanize(op.key) }));
      if (!op.key.startsWith(USER_KEY_PREFIX))
        return fail(
          "cannot_remove_base_item",
          msg(L, "baseNotRemovable", { name: nodeLabel(m, spec, op.key) }),
        );
      const nodes = { ...spec.nodes };
      delete nodes[op.key];
      const next = list.filter((it) => it.key !== op.key);
      return {
        ok: true,
        spec: withProps({ ...spec, nodes }, op.node, {
          ...node.props,
          [prop]: next as unknown as Value,
        }),
      };
    }
  }
}

// ───────────────────────────────── parse ──────────────────────────────────

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

function parseAnchor(v: unknown): Anchor | null {
  if (v === "start" || v === "end") return v;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const ks = Object.keys(o);
    if (ks.length === 1 && isStr(o.before)) return { before: o.before };
    if (ks.length === 1 && isStr(o.after)) return { after: o.after };
  }
  return null;
}

/** Narrows untrusted input (model output, stored JSON) to an `Op`, or null. */
export function parseOp(raw: unknown): Op | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isStr(o.node)) return null;
  switch (o.op) {
    case "set": {
      const p = o.path;
      if (!Array.isArray(p) || !(p.length === 1 || p.length === 3) || !p.every(isStr)) return null;
      if (!("value" in o) || o.value === undefined) return null;
      return { op: "set", node: o.node, path: p as Path, value: o.value as Value };
    }
    case "move": {
      const to = parseAnchor(o.to);
      if (!isStr(o.prop) || !isStr(o.key) || !to) return null;
      return { op: "move", node: o.node, prop: o.prop, key: o.key, to };
    }
    case "insert": {
      const to = parseAnchor(o.to);
      if (!isStr(o.prop) || !isStr(o.key) || !isStr(o.preset) || !to) return null;
      if (
        o.props !== undefined &&
        (!o.props || typeof o.props !== "object" || Array.isArray(o.props))
      )
        return null;
      return {
        op: "insert",
        node: o.node,
        prop: o.prop,
        preset: o.preset,
        key: o.key,
        to,
        ...(o.props ? { props: o.props as Record<string, Value> } : {}),
      };
    }
    case "remove":
      if (!isStr(o.prop) || !isStr(o.key)) return null;
      return { op: "remove", node: o.node, prop: o.prop, key: o.key };
    default:
      return null;
  }
}

// ───────────────────────────────── invert ─────────────────────────────────

/**
 * Returns the ops that undo `patch` when applied to the result of applying it to
 * `specBefore`. Ops that would not apply are ignored (they changed nothing).
 */
export function invert(
  m: Manifest<unknown>,
  specBefore: SurfaceSpec,
  patch: Pick<Patch, "ops"> | Op[],
): Op[] {
  const ops = Array.isArray(patch) ? patch : patch.ops;
  const inverse: Op[][] = [];
  let spec = specBefore;
  for (const raw of ops) {
    const op = parseOp(raw);
    if (!op) continue;
    const r = step(m, spec, op);
    if (!r.ok) continue;
    inverse.push(invertOne(m, spec, op));
    spec = r.spec;
  }
  return inverse.reverse().flat();
}

function prevAnchor(list: CollectionItem[], key: string): Anchor {
  const i = list.findIndex((it) => it.key === key);
  return i <= 0 ? "start" : { after: (list[i - 1] as CollectionItem).key };
}

function invertOne(m: Manifest<unknown>, spec: SurfaceSpec, op: Op): Op[] {
  const node = spec.nodes[op.node] as SpecNode;
  switch (op.op) {
    case "set": {
      if (op.path.length === 1) return [{ ...op, value: node.props[op.path[0]] ?? null }];
      const [prop, key, field] = op.path;
      const item = listOfNode(node, prop).find((it) => it.key === key);
      return [{ ...op, value: (item?.[field] as Value | undefined) ?? null }];
    }
    case "move":
      return [{ ...op, to: prevAnchor(listOfNode(node, op.prop), op.key) }];
    case "insert":
      return [{ op: "remove", node: op.node, prop: op.prop, key: op.key }];
    case "remove": {
      const removed = spec.nodes[op.key] as SpecNode;
      const preset = m.presets[removed.preset ?? ""];
      const reinsert: Op = {
        op: "insert",
        node: op.node,
        prop: op.prop,
        preset: removed.preset ?? "",
        key: op.key,
        to: prevAnchor(listOfNode(node, op.prop), op.key),
      };
      const restore = preset
        ? diffProps(m, op.key, removed.component, preset.node.props, removed.props)
        : [];
      // Keep the slot item's own fields (e.g. hidden) too.
      const slotItem = listOfNode(node, op.prop).find((it) => it.key === op.key);
      const itemFields: Op[] = Object.entries(slotItem ?? {})
        .filter(([f]) => f !== "key")
        .map(([f, v]) => ({
          op: "set",
          node: op.node,
          path: [op.prop, op.key, f],
          value: v as Value,
        }));
      return [reinsert, ...itemFields, ...restore];
    }
  }
}

/** Ops that turn `from` props into `to` props for one node (customizable props only). */
export function diffProps(
  m: Manifest<unknown>,
  nodeId: NodeId,
  component: string,
  from: Record<string, Value>,
  to: Record<string, Value>,
): Op[] {
  const out: Op[] = [];
  const comp = m.components[component];
  for (const [prop, def] of Object.entries(comp?.props ?? {})) {
    const a = from[prop];
    const b = to[prop];
    if (!isListType(def)) {
      if (!deepEqual(a ?? null, b ?? null))
        out.push({ op: "set", node: nodeId, path: [prop], value: b ?? null });
      continue;
    }
    let cur = (Array.isArray(a) ? a : []) as unknown as CollectionItem[];
    const target = (Array.isArray(b) ? b : []) as unknown as CollectionItem[];
    // order
    target.forEach((item, i) => {
      if (cur[i]?.key === item.key) return;
      const to: Anchor = i === 0 ? "start" : { after: (target[i - 1] as CollectionItem).key };
      out.push({ op: "move", node: nodeId, prop, key: item.key, to });
      const moving = cur.find((c) => c.key === item.key);
      if (moving) {
        cur = cur.filter((c) => c.key !== item.key);
        cur.splice(i, 0, moving);
      }
    });
    // fields
    for (const item of target) {
      const before = cur.find((c) => c.key === item.key) ?? { key: item.key };
      const fields = new Set([...Object.keys(before), ...Object.keys(item)]);
      fields.delete("key");
      for (const f of fields) {
        if (!deepEqual(before[f] ?? null, item[f] ?? null))
          out.push({
            op: "set",
            node: nodeId,
            path: [prop, item.key, f],
            value: (item[f] as Value) ?? null,
          });
      }
    }
  }
  return out;
}

// ───────────────────────────────── compose ────────────────────────────────

/**
 * Combines two op lists into one that has the same effect as applying `a` then `b`.
 * Redundant ops are dropped: repeated sets of one path keep only the last, repeated moves
 * of one item keep only the last, and an insert followed by a remove of the same item
 * cancels out (as long as nothing in between was placed relative to that item).
 */
export function compose(a: Op[], b: Op[]): Op[] {
  let ops = [...a, ...b];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < ops.length && !changed; i++) {
      const x = ops[i] as Op;
      for (let j = i + 1; j < ops.length; j++) {
        const y = ops[j] as Op;
        const between = ops.slice(i + 1, j);
        if (x.op === "set" && y.op === "set" && x.node === y.node && samePath(x.path, y.path)) {
          if (!between.some((o) => touchesItem(o, x.node, x.path[0], x.path[1]))) {
            ops = ops.filter((_, k) => k !== i);
            changed = true;
          }
          break;
        }
        if (
          x.op === "move" &&
          y.op === "move" &&
          x.node === y.node &&
          x.prop === y.prop &&
          x.key === y.key
        ) {
          if (!between.some((o) => anchorsOn(o, x.node, x.prop, x.key))) {
            ops = ops.filter((_, k) => k !== i);
            changed = true;
          }
          break;
        }
        if (
          x.op === "insert" &&
          y.op === "remove" &&
          x.node === y.node &&
          x.prop === y.prop &&
          x.key === y.key
        ) {
          const blocking = between.some((o) => anchorsOn(o, x.node, x.prop, x.key));
          if (!blocking) {
            // Drop the insert, the remove and everything in between that only touched the item.
            ops = ops.filter((o, k) => {
              if (k === i || k === j) return false;
              if (k > i && k < j)
                return !(o.node === x.key || touchesItem(o, x.node, x.prop, x.key));
              return true;
            });
            changed = true;
          }
          break;
        }
      }
    }
  }
  return ops;
}

function samePath(p: Path, q: Path): boolean {
  return p.length === q.length && p.every((s, i) => s === q[i]);
}

/** Does `o` add, remove, move or change item `key` of `node.prop`, or the node `key`? */
function touchesItem(o: Op, node: NodeId, prop: string, key: string | undefined): boolean {
  if (key === undefined) return (o.op === "insert" || o.op === "remove") && o.key === node;
  if (o.node === key) return true;
  if (o.node !== node) return false;
  if (o.op === "set") return o.path[0] === prop && o.path[1] === key;
  return o.prop === prop && (o.key === key || (o.op !== "remove" && anchorRef(o.to) === key));
}

function anchorsOn(o: Op, node: NodeId, prop: string, key: string): boolean {
  return (
    (o.op === "move" || o.op === "insert") &&
    o.node === node &&
    o.prop === prop &&
    anchorRef(o.to) === key
  );
}

// ───────────────────────────────── describe ───────────────────────────────

/** Deterministic, human-readable lines for each op. Used for previews, not model text. */
export function describe(
  m: Manifest<unknown>,
  specBefore: SurfaceSpec,
  patch: Pick<Patch, "ops"> | Op[],
) {
  const ops = Array.isArray(patch) ? patch : patch.ops;
  const changes: { opIndex: number; text: string }[] = [];
  let spec = specBefore;
  ops.forEach((raw, opIndex) => {
    const op = parseOp(raw);
    if (!op) return;
    const text = describeOne(m, spec, op);
    const r = step(m, spec, op);
    if (r.ok) spec = r.spec;
    changes.push({ opIndex, text });
  });
  return changes;
}

function describeOne(m: Manifest<unknown>, spec: SurfaceSpec, op: Op): string {
  const L = m.locale;
  const de = !!L?.toLowerCase().startsWith("de");
  const node = spec.nodes[op.node];
  const name = nodeLabel(m, spec, op.node);
  const prop = op.op === "set" ? op.path[0] : op.prop;
  const def = node ? m.components[node.component]?.props[prop] : undefined;
  const list = def && isListType(def) ? def : undefined;
  const item = (key: string) => (list ? itemLabel(m, spec, list, key) : quote(humanize(key), L));
  const place = (to: Anchor) =>
    to === "start"
      ? msg(L, "toStart")
      : to === "end"
        ? msg(L, "toEnd")
        : "before" in to
          ? msg(L, "before", { item: item(to.before) })
          : msg(L, "after", { item: item(to.after) });
  const inName = list?.kind === "collection" ? msg(L, "inName", { name }) : "";
  // English lowercases a setting's name mid-sentence; German keeps it.
  const settingName = (label: string) => (de ? label : lowerFirst(label));

  switch (op.op) {
    case "set": {
      if (op.path.length === 1)
        return msg(L, "setProp", {
          prop: settingName(tx(def?.label, L) ?? humanize(prop)),
          value: formatValue(def, op.value, L),
          name,
        });
      const [, key, field] = op.path;
      if (field === "hidden")
        return msg(L, op.value === true ? "hide" : "show", { item: item(key), inName });
      const fdef = list?.kind === "collection" ? list.item[field] : undefined;
      return msg(L, "setField", {
        field: settingName(tx(fdef?.label, L) ?? humanize(field)),
        item: item(key),
        value: formatValue(fdef, op.value, L),
        inName,
      });
    }
    case "move":
      return msg(L, "move", { item: item(op.key), place: place(op.to), inName });
    case "insert": {
      const preset = m.presets[op.preset];
      const comp = preset ? m.components[preset.node.component] : undefined;
      const settings = Object.entries(op.props ?? {})
        .map(([k, v]) =>
          comp?.props[k]?.kind === "query" ? formatValue(comp.props[k], v, L) : null,
        )
        .filter(Boolean);
      const what = settings.length ? `: ${settings.join(", ")}` : "";
      return msg(L, "add", {
        preset: tx(preset?.label, L) ?? humanize(op.preset),
        what,
        place: place(op.to),
      });
    }
    case "remove":
      return msg(L, "remove", { name: nodeLabel(m, spec, op.key) });
  }
}

// ───────────────────────────────── utils ──────────────────────────────────

/** "Rows per page" → "rows per page", but leaves acronyms ("URL", "KPI") alone. */
function lowerFirst(label: string): string {
  return /^[A-Z][A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
}
