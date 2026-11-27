import { expect, describe as group, it } from "vitest";
import { apply, compose, describe, invert, type Op, parseOp, validate } from "../src/index.js";
import { baseSpec, briefPatch, dashboard } from "./fixtures.js";

const keys = (v: unknown) => (v as { key: string }[]).map((i) => i.key);

group("apply", () => {
  it("applies the example patch from the architecture doc", () => {
    const r = apply(dashboard, baseSpec, briefPatch);
    expect(r.skipped).toEqual([]);
    expect(keys(r.spec.nodes.page?.props.main)).toEqual([
      "filters",
      "kpis",
      "appointments",
      "revenue-chart",
    ]);
    expect(r.spec.nodes.filters?.props.dateRange).toEqual({ relative: "thisWeek" });
    const cols = r.spec.nodes.appointments?.props.columns as { key: string; hidden?: boolean }[];
    expect(cols.find((c) => c.key === "revenue")?.hidden).toBe(true);
  });

  it("does not mutate its input", () => {
    const before = structuredClone(baseSpec);
    apply(dashboard, baseSpec, briefPatch);
    expect(baseSpec).toEqual(before);
  });

  it("strict mode applies nothing if any op is invalid", () => {
    const ops: Op[] = [
      ...briefPatch.ops,
      { op: "set", node: "appointments", path: ["pageSize"], value: 5000 },
    ];
    const r = apply(dashboard, baseSpec, ops, "strict");
    expect(r.spec).toBe(baseSpec);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]?.message).toBe("Rows per page must be a whole number from 10 to 100.");
  });

  it("tolerant mode skips invalid ops and applies the rest", () => {
    const ops: Op[] = [
      { op: "move", node: "appointments", prop: "columns", key: "status", to: { after: "gone" } },
      { op: "set", node: "appointments", path: ["columns", "vet", "hidden"], value: true },
    ];
    const r = apply(dashboard, baseSpec, ops, "tolerant");
    expect(r.applied).toHaveLength(1);
    expect(r.skipped.map((s) => s.code)).toEqual(["unknown_anchor"]);
  });

  it("moves with every anchor form", () => {
    const mv = (to: Op & { op: "move" } extends { to: infer A } ? A : never) =>
      keys(
        apply(dashboard, baseSpec, [
          { op: "move", node: "appointments", prop: "columns", key: "status", to },
        ]).spec.nodes.appointments?.props.columns,
      );
    expect(mv({ after: "date" })).toEqual(["date", "status", "patient", "vet", "revenue"]);
    expect(mv({ before: "date" })).toEqual(["status", "date", "patient", "vet", "revenue"]);
    expect(mv("start")).toEqual(["status", "date", "patient", "vet", "revenue"]);
    expect(mv("end")).toEqual(["date", "patient", "vet", "revenue", "status"]);
  });

  it("inserts presets and removes only user-inserted items", () => {
    const ins = apply(dashboard, baseSpec, [
      {
        op: "insert",
        node: "kpis",
        prop: "cards",
        preset: "stat.noShows",
        key: "u_1",
        to: "start",
      },
    ]);
    expect(ins.skipped).toEqual([]);
    expect(keys(ins.spec.nodes.kpis?.props.cards)).toEqual(["u_1", "stat-visits", "stat-revenue"]);
    expect(ins.spec.nodes.u_1).toEqual({
      component: "StatCard",
      props: { metric: "noShows" },
      preset: "stat.noShows",
    });

    const rm = apply(dashboard, ins.spec, [
      { op: "remove", node: "kpis", prop: "cards", key: "u_1" },
    ]);
    expect(rm.spec).toEqual(baseSpec);
  });
});

group("validate: readable refusals", () => {
  const msg = (op: Op) => validate(dashboard, baseSpec, [op])[0]?.message;

  it('rejects adding things that are not presets ("add a delete button")', () => {
    expect(
      msg({
        op: "insert",
        node: "kpis",
        prop: "cards",
        preset: "deleteButton",
        key: "u_x",
        to: "end",
      }),
    ).toBe("“Delete button” isn't something you can add here. You can add: No-shows card.");
    expect(
      msg({
        op: "insert",
        node: "page",
        prop: "main",
        preset: "stat.noShows",
        key: "u_x",
        to: "end",
      }),
    ).toBe("No-shows card isn't something you can add here.");
  });

  it("rejects removing base items, but explains they can be hidden", () => {
    expect(msg({ op: "remove", node: "page", prop: "main", key: "revenue-chart" })).toBe(
      "Revenue chart is part of the page and can be hidden, but not removed.",
    );
  });

  it("rejects props the manifest does not open up", () => {
    expect(msg({ op: "set", node: "revenue-chart", path: ["metric"], value: "salaries" })).toBe(
      "Metric of Revenue chart can't be changed.",
    );
    expect(msg({ op: "set", node: "appointments", path: ["onRowClick"], value: "alert(1)" })).toBe(
      "Appointments table has no setting called “onRowClick”.",
    );
  });

  it("rejects unknown nodes, keys and bad values", () => {
    expect(msg({ op: "set", node: "otherUsers", path: ["x"], value: 1 })).toBe(
      "There is no “otherUsers” on this page.",
    );
    expect(
      msg({ op: "set", node: "appointments", path: ["columns", "ssn", "hidden"], value: false }),
    ).toBe("Appointments table has no Ssn.");
    expect(
      msg({ op: "set", node: "filters", path: ["dateRange"], value: { from: "2020-01-01" } }),
    ).toMatch(/^Date range must be one of Today, This week/);
    expect(
      msg({
        op: "set",
        node: "appointments",
        path: ["columns", "date", "label"],
        value: "x".repeat(41),
      }),
    ).toBe("Heading of “Date” must be at most 40 characters.");
  });

  it("rejects replacing a whole collection (would let a patch invent columns)", () => {
    expect(
      msg({ op: "set", node: "appointments", path: ["columns"], value: [{ key: "ssn" }] }),
    ).toBe("Columns of Appointments table can't be replaced as a whole.");
  });
});

group("invert", () => {
  it("matches the inverse in the architecture doc", () => {
    expect(invert(dashboard, baseSpec, briefPatch)).toEqual([
      { op: "set", node: "filters", path: ["dateRange"], value: { relative: "last30Days" } },
      {
        op: "move",
        node: "page",
        prop: "main",
        key: "appointments",
        to: { after: "revenue-chart" },
      },
      { op: "set", node: "appointments", path: ["columns", "revenue", "hidden"], value: null },
    ]);
  });
});

group("compose", () => {
  it("collapses repeated sets and cancels insert + remove", () => {
    const a: Op[] = [
      { op: "set", node: "appointments", path: ["pageSize"], value: 50 },
      { op: "insert", node: "kpis", prop: "cards", preset: "stat.noShows", key: "u_1", to: "end" },
    ];
    const b: Op[] = [
      { op: "set", node: "appointments", path: ["pageSize"], value: 10 },
      { op: "set", node: "kpis", path: ["cards", "u_1", "hidden"], value: true },
      { op: "remove", node: "kpis", prop: "cards", key: "u_1" },
    ];
    expect(compose(a, b)).toEqual([
      { op: "set", node: "appointments", path: ["pageSize"], value: 10 },
    ]);
  });
});

group("describe", () => {
  it("produces readable preview lines from the ops themselves", () => {
    expect(describe(dashboard, baseSpec, briefPatch).map((c) => c.text)).toEqual([
      "Hide “Revenue” in Appointments table",
      "Move Appointments table before Revenue chart",
      "Set Date range of Filters to This week",
    ]);
  });
});

group("parseOp", () => {
  it("rejects malformed input", () => {
    for (const bad of [
      null,
      1,
      "x",
      [],
      {},
      { op: "set", node: "a" },
      { op: "eval", node: "a" },
      { op: "move", node: "a", prop: "p", key: "k", to: { before: 1 } },
    ])
      expect(parseOp(bad)).toBeNull();
  });
});
