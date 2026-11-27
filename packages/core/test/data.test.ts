import fc from "fast-check";
import { expect, describe as group, it } from "vitest";
import {
  aggregate,
  apply,
  buildOutputSchema,
  defineCatalog,
  describe,
  f,
  fromModelOutput,
  type Op,
  publicCatalog,
  type Query,
  resolve,
  restrictManifest,
  runQuery,
  validate,
} from "../src/index.js";
import { catalog, dataSurface as m } from "./data-fixtures.js";

const keys = (v: unknown) =>
  (v as { key: string; hidden?: boolean }[]).map((i) => `${i.key}${i.hidden ? "(hidden)" : ""}`);
const insertChart = (query: unknown): Op => ({
  op: "insert",
  node: "page",
  prop: "main",
  preset: "block.chart",
  key: "u_1",
  to: "end",
  props: { kind: "bar", query: query as never },
});

group("defineCatalog", () => {
  it("only accepts same-origin GET endpoints", () => {
    const bad =
      (path: string, method = "GET") =>
      () =>
        defineCatalog({
          x: { label: "X", endpoint: { path, method: method as "GET" }, fields: { a: f.string() } },
        });
    expect(bad("/api/x", "POST")).toThrow(/only GET/);
    expect(bad("https://evil.example/x")).toThrow(/same-origin/);
    expect(bad("//evil.example/x")).toThrow(/same-origin/);
    expect(bad("/api/../admin")).toThrow(/same-origin/);
    expect(bad("/api/x")).not.toThrow();
  });
});

group("keysFrom", () => {
  it("adds offerable catalog fields to the base, hidden; never sensitive ones", () => {
    expect(keys(m.base.nodes.table?.props.columns)).toEqual([
      "date",
      "vet",
      "revenue",
      "status(hidden)",
      "owner(hidden)",
    ]);
    expect(
      validate(m, m.base, [
        { op: "set", node: "table", path: ["columns", "owner", "hidden"], value: false },
      ]),
    ).toEqual([]);
    expect(
      validate(m, m.base, [
        { op: "set", node: "table", path: ["columns", "ownerPhone", "hidden"], value: false },
      ])[0]?.code,
    ).toBe("unknown_key");
  });
});

group("data blocks", () => {
  const finance = restrictManifest(m, { permissions: ["finance.read"] });
  const noFinance = restrictManifest(m, { permissions: [] });
  const spec = (mm: typeof m) => resolve(mm, []).spec;

  it("inserts a configured block and describes it from the query", () => {
    const op = insertChart({
      source: "appointments",
      groupBy: { field: "vet" },
      metric: { op: "sum", field: "revenue" },
    });
    expect(validate(finance, spec(finance), [op])).toEqual([]);
    const r = apply(finance, spec(finance), [op]);
    expect(r.spec.nodes.u_1?.props.query).toMatchObject({ groupBy: { field: "vet" } });
    expect(describe(finance, spec(finance), [op])[0]?.text).toBe(
      "Add Chart: Total revenue by vet to the end",
    );
  });

  const msg = (mm: typeof m, query: unknown) =>
    validate(mm, spec(mm), [insertChart(query)])[0]?.message;

  it("rejects unknown sources, unknown and sensitive fields, and wrong aggregations", () => {
    expect(
      msg(finance, { source: "users", groupBy: { field: "vet" }, metric: { op: "count" } }),
    ).toBe("A new chart can only show data from Appointments, Invoices.");
    expect(
      msg(finance, {
        source: "appointments",
        groupBy: { field: "ownerPhone" },
        metric: { op: "count" },
      }),
    ).toBe("A new chart can't use “ownerPhone”: it isn't available to you in Appointments.");
    expect(
      msg(finance, {
        source: "appointments",
        groupBy: { field: "vet" },
        metric: { op: "sum", field: "owner" },
      }),
    ).toMatch(/can't use Owner that way/);
    expect(
      msg(finance, { source: "appointments", groupBy: { field: "date" }, metric: { op: "count" } }),
    ).toMatch(/day, week or month/);
    expect(
      msg(finance, { source: "invoices", groupBy: { field: "customer" }, metric: { op: "count" } }),
    ).toMatch(/Invoices can't be summarized/);
    expect(
      msg(finance, {
        source: "appointments",
        groupBy: { field: "vet" },
        metric: { op: "count" },
        sql: "drop table",
      }),
    ).toMatch(/can't use “sql”/);
  });

  it("removes fields the user lacks permission for, everywhere", () => {
    expect(
      msg(noFinance, {
        source: "appointments",
        groupBy: { field: "vet" },
        metric: { op: "sum", field: "revenue" },
      }),
    ).toBe("A new chart can't use “revenue”: it isn't available to you in Appointments.");
    const s = spec(noFinance);
    expect(keys(s.nodes.table?.props.columns)).not.toContain("revenue");
    expect(s.nodes.trend?.props.query).toBeUndefined(); // base query used revenue: dropped for this user
    expect(JSON.stringify(buildOutputSchema(noFinance, s))).not.toContain("revenue");
    expect(
      publicCatalog(noFinance.catalog ?? catalog).sources.appointments?.fields,
    ).not.toHaveProperty("revenue");
  });

  it("the model's insert props are cleaned of nulls and validated", () => {
    const r = fromModelOutput(
      {
        kind: "patch",
        message: "",
        ops: [
          {
            op: "insert",
            node: "page",
            prop: "main",
            preset: "block.stat",
            position: "end",
            anchor: "",
            props: {
              query: {
                source: "appointments",
                metric: { op: "count", field: null },
                where: [{ field: "status", value: "noShow" }],
              },
            },
          },
        ],
      },
      () => "u_9",
    );
    if (r.kind !== "patch") throw new Error();
    expect(r.ops[0]).toMatchObject({ props: { query: { metric: { op: "count" } } } });
    expect(validate(finance, spec(finance), r.ops)).toEqual([]);
    expect(describe(finance, spec(finance), r.ops)[0]?.text).toBe(
      "Add Number card: Number of appointments where Status is No-show to the end",
    );
  });

  it("output schema offers per-preset props with the query shape", () => {
    const json = JSON.stringify(buildOutputSchema(finance, spec(finance)));
    expect(json).toContain('"const":"block.chart"');
    expect(json).toContain('"groupBy"');
    expect(json).not.toContain("ownerPhone");
    expect(json).not.toContain("/api/"); // endpoints never reach the model
  });
});

group("runQuery", () => {
  const rows = [
    { id: 1, date: "2026-11-02", vet: "A", status: "completed", revenue: 100 },
    { id: 2, date: "2026-11-03", vet: "B", status: "completed", revenue: 50 },
    { id: 3, date: "2026-11-10", vet: "A", status: "noShow", revenue: 0 },
  ];
  it("computes rows, series and single values", () => {
    expect(
      runQuery(
        catalog,
        {
          source: "appointments",
          fields: ["vet", "revenue"],
          sort: { field: "revenue", dir: "desc" },
          limit: 2,
        },
        rows,
      ),
    ).toMatchObject({
      shape: "rows",
      rows: [
        { id: 1, vet: "A", revenue: 100 },
        { id: 2, vet: "B", revenue: 50 },
      ],
    });
    expect(
      runQuery(
        catalog,
        {
          source: "appointments",
          groupBy: { field: "date", bucket: "week" },
          metric: { op: "sum", field: "revenue" },
        },
        rows,
      ),
    ).toMatchObject({
      shape: "series",
      points: [
        { key: "2026-11-02", value: 150 },
        { key: "2026-11-09", value: 0 },
      ],
    });
    expect(
      runQuery(
        catalog,
        {
          source: "appointments",
          metric: { op: "count" },
          where: [{ field: "status", value: "noShow" }],
        },
        rows,
      ),
    ).toMatchObject({ shape: "single", value: 1 });
    expect(
      runQuery(
        catalog,
        { source: "appointments", groupBy: { field: "status" }, metric: { op: "count" } },
        rows,
      ),
    ).toMatchObject({
      points: [
        { key: "completed", value: 2 },
        { key: "noShow", label: "No-show", value: 1 },
      ],
    });
  });

  it("group totals add up to the overall total (property)", () => {
    const row = fc.record({
      vet: fc.constantFrom("A", "B", "C"),
      date: fc
        .date({ min: new Date("2026-01-01"), max: new Date("2026-12-31"), noInvalidDate: true })
        .map((d) => d.toISOString().slice(0, 10)),
      revenue: fc.integer({ min: 0, max: 1000 }),
    });
    fc.assert(
      fc.property(fc.array(row, { maxLength: 60 }), fc.constantFrom("vet", "date"), (rs, by) => {
        const q: Query = {
          source: "appointments",
          groupBy: by === "date" ? { field: "date", bucket: "month" } : { field: "vet" },
          metric: { op: "sum", field: "revenue" },
        };
        const series = runQuery(catalog, q, rs);
        const count = runQuery(catalog, { ...q, metric: { op: "count" } }, rs);
        if (series.shape !== "series" || count.shape !== "series") throw new Error();
        expect(series.points.reduce((a, p) => a + p.value, 0)).toBe(
          aggregate("sum", rs, "revenue"),
        );
        expect(count.points.reduce((a, p) => a + p.value, 0)).toBe(rs.length);
      }),
    );
  });

  it("ignores junk rows", () => {
    expect(
      runQuery(catalog, { source: "appointments", metric: { op: "sum", field: "revenue" } }, [
        null,
        1,
        "x",
        { revenue: "12" },
        { revenue: 3 },
      ]),
    ).toMatchObject({ value: 3 });
    expect(
      runQuery(catalog, { source: "appointments", metric: { op: "count" } }, { not: "an array" }),
    ).toMatchObject({ value: 0 });
  });
});

it("doesn't stutter when a field is called total", () => {
  const c = defineCatalog({
    orders: {
      label: "Orders",
      endpoint: { path: "/api/orders", method: "GET" },
      complete: true,
      fields: { total: f.currency("EUR"), status: f.string() },
    },
  });
  expect(
    runQuery(
      c,
      { source: "orders", groupBy: { field: "status" }, metric: { op: "sum", field: "total" } },
      [],
    ).label,
  ).toBe("Sum of total by status");
});
