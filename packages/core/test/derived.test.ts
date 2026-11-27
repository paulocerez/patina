import { expect, describe as group, it } from "vitest";
import {
  checkQuery,
  defineCatalog,
  describeQuery,
  f,
  publicCatalog,
  type QueryDef,
  restrictCatalog,
  runQuery,
} from "../src/index.js";
import { describeSources } from "../src/model.js";
import { querySchema } from "../src/query.js";

const catalog = defineCatalog({
  calls: {
    label: { en: "Calls", de: "Anrufe" },
    endpoint: { path: "/api/calls", method: "GET" },
    complete: true,
    rowKey: "id",
    params: {
      range: {
        from: "page.dateRange",
        label: { en: "Date range", de: "Zeitraum" },
        choices: ["today", "thisWeek", "last30days"],
        choiceLabels: {
          today: { en: "Today", de: "Heute" },
          thisWeek: { en: "This week", de: "Diese Woche" },
          last30days: { en: "Last 30 days", de: "Letzte 30 Tage" },
        },
      },
    },
    fields: {
      startedAt: f.date({ label: "Started" }),
      duration: f.number({ label: "Duration" }),
      task: f.string({ label: "Task" }),
      caller: f.string({ label: "Caller", sensitive: true }),
      weekday: f.weekday("startedAt", { label: "Weekday", timeZone: "UTC" }),
      hour: f.hour("startedAt", { label: "Hour", timeZone: "Europe/Berlin" }),
      length: f.ranges(
        "duration",
        [{ value: "short", below: 25 }, { value: "normal", below: 300 }, { value: "long" }],
        { label: "Length" },
      ),
      emergency: f.contains("task", ["notfall", "emergency"], { label: "Emergency" }),
    },
  },
});

const ROWS = [
  { id: 1, startedAt: "2026-11-23T07:30:00Z", duration: 12, task: "Notfallweiterleitung" },
  { id: 2, startedAt: "2026-11-24T09:00:00Z", duration: 90, task: "Terminvereinbarung" },
  { id: 3, startedAt: "2026-11-24T16:59:00Z", duration: 400, task: "Rückruf" },
  { id: 4, startedAt: null, duration: null, task: null },
];

const series = (field: string) =>
  runQuery(catalog, { source: "calls", groupBy: { field }, metric: { op: "count" } }, ROWS, "en");

group("derived fields", () => {
  it("groups by weekday and hour in the declared time zone, in their natural order", () => {
    expect(series("weekday")).toMatchObject({
      points: [
        { key: "mon", label: "Monday", value: 1 },
        { key: "tue", label: "Tuesday", value: 2 },
      ],
    });
    // Berlin is UTC+1 in November.
    expect(series("hour")).toMatchObject({
      points: [
        { key: "08", label: "08:00", value: 1 },
        { key: "10", label: "10:00", value: 1 },
        { key: "17", label: "17:00", value: 1 },
      ],
    });
  });

  it("puts numbers into ranges, in the ranges' order, and skips rows without a number", () => {
    const length = series("length");
    expect(length.shape === "series" && length.points).toEqual([
      { key: "short", label: "short", value: 1 },
      { key: "normal", label: "normal", value: 1 },
      { key: "long", label: "long", value: 1 },
    ]);
  });

  it("flags text containing any of the words, case-insensitively, and can be filtered on", () => {
    const r = runQuery(
      catalog,
      { source: "calls", metric: { op: "count" }, where: [{ field: "emergency", value: true }] },
      ROWS,
      "en",
    );
    expect(r).toMatchObject({ shape: "single", value: 1 });
  });

  it("shows derived values in tables", () => {
    const r = runQuery(catalog, { source: "calls", fields: ["length", "weekday"] }, ROWS, "en");
    expect(r.shape === "rows" && r.rows[0]).toEqual({ id: 1, length: "short", weekday: "mon" });
  });

  it("travels to the browser and the model as ordinary enum and bool fields", () => {
    const pub = publicCatalog(catalog, "de").sources.calls;
    expect(pub?.fields.weekday).toMatchObject({
      kind: "enum",
      valueLabels: { mon: "Montag" },
      derive: { op: "weekday", from: "startedAt" },
    });
    expect(pub?.fields.caller).toBeUndefined();
    const model = describeSources({ catalog, locale: "de" } as never) as Record<
      string,
      { fields: Record<string, { kind: string }> }
    >;
    expect(model.calls?.fields.emergency).toMatchObject({ kind: "bool" });
  });

  it.each([
    [{ x: f.weekday("missing") }, 'derives from "missing"'],
    [{ s: f.string(), x: f.weekday("s") }, '"weekday" needs a date field'],
    [{ s: f.string({ sensitive: true }), x: f.contains("s", ["a"]) }, "sensitive field"],
    [{ n: f.number(), x: f.ranges("n", [{ value: "a", below: 2 }]) }, "at least two entries"],
    [
      {
        n: f.number(),
        x: f.ranges("n", [{ value: "a", below: 5 }, { value: "b", below: 2 }, { value: "c" }]),
      },
      "larger than the one before",
    ],
    [{ s: f.string(), x: f.contains("s", [" "]) }, "at least one word"],
    [{ d: f.date(), w: f.weekday("d"), x: f.contains("w", ["mon"]) }, "another derived field"],
  ])("refuses an unsafe or malformed derivation (%#)", (fields, problem) => {
    expect(() =>
      defineCatalog({
        s: { label: "S", endpoint: { path: "/api/s", method: "GET" }, fields: fields as never },
      }),
    ).toThrow(problem);
  });
});

group("tenant values", () => {
  const restricted = restrictCatalog(catalog, {
    values: {
      "calls.task": ["Notfallweiterleitung", "Terminvereinbarung", "Notfallweiterleitung"],
    },
  });
  const def: QueryDef = {
    kind: "query",
    catalog: restricted,
    shape: "single",
    aggregations: ["count"],
  };

  it("turns a text field into an enum of this tenant's values, so views can filter on it", () => {
    expect(restricted.sources.calls?.fields.task).toMatchObject({
      kind: "enum",
      values: ["Notfallweiterleitung", "Terminvereinbarung"],
    });
    const q = {
      source: "calls",
      metric: { op: "count" },
      where: [{ field: "task", value: "Terminvereinbarung" }],
    };
    expect(checkQuery(def, q)).toBeNull();
    expect(runQuery(restricted, q as never, ROWS)).toMatchObject({ value: 1 });
  });

  it("leaves the field alone without values, and never touches derived or other fields", () => {
    expect(
      restrictCatalog(catalog, { values: { "calls.task": [] } }).sources.calls?.fields.task?.kind,
    ).toBe("string");
    expect(
      restrictCatalog(catalog, { values: { "calls.duration": ["1"] } }).sources.calls?.fields
        .duration?.kind,
    ).toBe("number");
  });
});

group("per-view params", () => {
  const def: QueryDef = { kind: "query", catalog, shape: "single", aggregations: ["count"] };

  it("lets a view pick one of the declared choices, and names it", () => {
    const q = { source: "calls", metric: { op: "count" as const }, params: { range: "thisWeek" } };
    expect(checkQuery(def, q)).toBeNull();
    expect(describeQuery(catalog, q, "de")).toBe("Anzahl Anrufe (Diese Woche)");
  });

  it.each([{ range: "lastYear" }, { other: "x" }, { range: 7 }])("refuses %j", (params) => {
    expect(checkQuery(def, { source: "calls", metric: { op: "count" }, params }, "en")).toMatch(
      /can't use that value/,
    );
  });

  it("offers the choices to the model, in the schema and the source description", () => {
    expect(JSON.stringify(querySchema(def))).toContain('"enum":["today","thisWeek","last30days"]');
    const model = describeSources({ catalog, locale: "de" } as never) as Record<
      string,
      { perViewParams?: Record<string, { choices: { label: string }[] }> }
    >;
    expect(model.calls?.perViewParams?.range?.choices.map((c) => c.label)).toEqual([
      "Heute",
      "Diese Woche",
      "Letzte 30 Tage",
    ]);
  });

  it("refuses malformed choices at startup", () => {
    expect(() =>
      defineCatalog({
        s: {
          label: "S",
          endpoint: { path: "/api/s", method: "GET" },
          params: { r: { value: "a", choices: ["a", "a"] } },
          fields: { x: f.string() },
        },
      }),
    ).toThrow("choices must be unique");
  });
});
