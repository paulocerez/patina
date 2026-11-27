import fc from "fast-check";
import { expect, describe as group, it } from "vitest";
import { baseSpec, dashboard } from "./fixtures.js";
import {
  type Anchor,
  apply,
  type CollectionItem,
  compose,
  deepEqual,
  invert,
  isListTypeForTest,
  type Op,
  type SurfaceSpec,
  type TypeDef,
  validate,
} from "./helpers.js";

/** Sample values for a scalar type: valid ones plus `null` (back to default). */
function samples(def: TypeDef): unknown[] {
  switch (def.kind) {
    case "enum":
      return [...def.values, null];
    case "int":
      return [def.min, def.max, Math.floor((def.min + def.max) / 2), null];
    case "bool":
      return [true, false, null];
    case "label":
      return ["A", "Total €", null];
    case "relativeDateRange":
      return [...def.allowed.map((relative) => ({ relative })), null];
    case "sort":
      return [
        { key: def.keys[0], dir: "asc" },
        { key: def.keys[def.keys.length - 1], dir: "desc" },
        null,
      ];
    default:
      return [null];
  }
}

let keyCounter = 0;

/** Every op that is valid on `spec` (with a small set of sample values). */
function candidates(spec: SurfaceSpec): Op[] {
  const out: Op[] = [];
  for (const [node, n] of Object.entries(spec.nodes)) {
    const comp = dashboard.components[n.component];
    for (const [prop, def] of Object.entries(comp?.props ?? {})) {
      if (!isListTypeForTest(def)) {
        for (const value of samples(def)) out.push({ op: "set", node, path: [prop], value } as Op);
        continue;
      }
      const list = (n.props[prop] ?? []) as unknown as CollectionItem[];
      const ks = list.map((i) => i.key);
      for (const key of ks) {
        if (def.hide)
          for (const value of [true, false, null])
            out.push({ op: "set", node, path: [prop, key, "hidden"], value });
        if (def.kind === "collection")
          for (const [field, fdef] of Object.entries(def.item))
            for (const value of samples(fdef))
              out.push({ op: "set", node, path: [prop, key, field], value } as Op);
        if (def.reorder) {
          const anchors: Anchor[] = [
            "start",
            "end",
            ...ks.filter((k) => k !== key).flatMap((k) => [{ before: k }, { after: k }]),
          ];
          for (const to of anchors) out.push({ op: "move", node, prop, key, to });
        }
        if (key.startsWith("u_")) out.push({ op: "remove", node, prop, key });
      }
      if (def.kind === "slot")
        for (const preset of def.insert)
          out.push({
            op: "insert",
            node,
            prop,
            preset,
            key: `u_${++keyCounter}`,
            to: ks[0] ? { after: ks[0] } : "end",
          });
    }
  }
  return out;
}

/** Builds a valid op sequence from random choices, starting at `spec`. */
function build(spec: SurfaceSpec, choices: number[]): { ops: Op[]; end: SurfaceSpec } {
  const ops: Op[] = [];
  let s = spec;
  for (const c of choices) {
    const cs = candidates(s);
    const op = cs[c % cs.length] as Op;
    const r = apply(dashboard, s, [op]);
    if (r.skipped.length)
      throw new Error(`generator produced an invalid op: ${JSON.stringify(r.skipped)}`);
    ops.push(op);
    s = r.spec;
  }
  return { ops, end: s };
}

const choices = fc.array(fc.nat(), { maxLength: 15 });
const run = (s: SurfaceSpec, ops: Op[]) => {
  const r = apply(dashboard, s, ops);
  expect(r.skipped).toEqual([]);
  return r.spec;
};

group("patch engine properties", () => {
  it("invert round-trips: apply(apply(s, p), invert(s, p)) ≡ s", () => {
    fc.assert(
      fc.property(choices, choices, (pre, cs) => {
        const s = build(baseSpec, pre).end;
        const { ops, end } = build(s, cs);
        const back = run(end, invert(dashboard, s, ops));
        expect(deepEqual(back, s)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("compose ≡ sequential apply", () => {
    fc.assert(
      fc.property(choices, choices, (ca, cb) => {
        const a = build(baseSpec, ca);
        const b = build(a.end, cb);
        expect(deepEqual(run(baseSpec, compose(a.ops, b.ops)), b.end)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("compose is associative (in effect)", () => {
    fc.assert(
      fc.property(choices, choices, choices, (ca, cb, cc) => {
        const a = build(baseSpec, ca);
        const b = build(a.end, cb);
        const c = build(b.end, cc);
        const left = run(baseSpec, compose(compose(a.ops, b.ops), c.ops));
        const right = run(baseSpec, compose(a.ops, compose(b.ops, c.ops)));
        expect(deepEqual(left, right)).toBe(true);
        expect(deepEqual(left, c.end)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("tolerant apply never throws, whatever the input", () => {
    fc.assert(
      fc.property(fc.anything(), fc.array(fc.anything(), { maxLength: 5 }), (raw, list) => {
        apply(dashboard, baseSpec, raw as Op[], "tolerant");
        apply(dashboard, baseSpec, { ops: list as Op[] }, "tolerant");
        validate(dashboard, baseSpec, list as Op[]);
      }),
      { numRuns: 500 },
    );
  });

  it("tolerant apply never throws on near-miss ops", () => {
    const anyOp = fc.record({
      op: fc.constantFrom("set", "move", "insert", "remove"),
      node: fc.constantFrom("page", "appointments", "kpis", "filters", "nope", "u_1"),
      prop: fc.constantFrom("main", "columns", "cards", "pageSize", "x"),
      path: fc.oneof(
        fc.constant(["pageSize"]),
        fc.constant(["columns", "date", "hidden"]),
        fc.array(fc.string(), { maxLength: 4 }),
      ),
      key: fc.constantFrom("date", "u_1", "filters", "stat-visits", "zzz"),
      preset: fc.constantFrom("stat.noShows", "evil"),
      to: fc.oneof(
        fc.constantFrom("start", "end"),
        fc.record({ before: fc.constantFrom("date", "kpis", "zz") }),
      ),
      value: fc.anything(),
    });
    fc.assert(
      fc.property(fc.array(anyOp, { maxLength: 8 }), (ops) => {
        const r = apply(dashboard, baseSpec, ops as unknown as Op[], "tolerant");
        expect(r.applied.length + r.skipped.length).toBe(ops.length);
      }),
      { numRuns: 500 },
    );
  });

  it("validate passing ⇒ strict apply succeeds and equals tolerant apply", () => {
    fc.assert(
      fc.property(choices, (cs) => {
        const { ops } = build(baseSpec, cs);
        expect(validate(dashboard, baseSpec, ops)).toEqual([]);
        expect(apply(dashboard, baseSpec, ops, "strict").spec).toEqual(
          apply(dashboard, baseSpec, ops, "tolerant").spec,
        );
      }),
    );
  });
});
