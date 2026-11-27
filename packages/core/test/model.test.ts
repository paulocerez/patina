import { expect, it } from "vitest";
import {
  buildCompactSchema,
  buildModelRequest,
  buildOutputSchema,
  fromModelOutput,
  restrictManifest,
  validate,
} from "../src/index.js";
import { dataSurface } from "./data-fixtures.js";
import { baseSpec, dashboard } from "./fixtures.js";

function walk(schema: unknown, visit: (o: Record<string, unknown>) => void) {
  if (Array.isArray(schema)) {
    for (const s of schema) walk(s, visit);
    return;
  }
  if (schema && typeof schema === "object") {
    visit(schema as Record<string, unknown>);
    for (const v of Object.values(schema)) walk(v, visit);
  }
}

it.each([
  ["dashboard", () => buildOutputSchema(dashboard, baseSpec)],
  ["data surface", () => buildOutputSchema(dataSurface, dataSurface.base)],
  ["compact (dashboard)", () => buildCompactSchema(dashboard, baseSpec)],
  ["compact (data surface)", () => buildCompactSchema(dataSurface, dataSurface.base)],
])("output schema stays inside the structured-output subset (%s)", (_name, build) => {
  const schema = build();
  walk(schema, (o) => {
    if (o.type === "object") {
      expect(o.additionalProperties).toBe(false);
      expect(o.required).toEqual(Object.keys(o.properties as object));
    }
    for (const banned of ["minimum", "maximum", "minLength", "maxLength", "pattern", "format"])
      expect(o).not.toHaveProperty(banned);
  });
});

it("output schema only offers what the restricted manifest allows", () => {
  const m = restrictManifest(dashboard, {
    keys: ["revenue"],
    nodes: ["revenue-chart", "stat-revenue"],
  });
  const json = JSON.stringify(buildOutputSchema(m, baseSpec));
  expect(json).toContain('"const":"appointments"');
  expect(json).not.toContain('"const":"metric"'); // not customizable
  expect(json).toContain('"stat.noShows"');
});

it("converts the model's flattened ops and generates insert keys itself", () => {
  const r = fromModelOutput(
    {
      kind: "patch",
      message: "Done",
      ops: [
        {
          op: "setItem",
          node: "appointments",
          prop: "columns",
          key: "revenue",
          field: "hidden",
          value: true,
        },
        {
          op: "move",
          node: "appointments",
          prop: "columns",
          key: "status",
          position: "after",
          anchor: "date",
        },
        {
          op: "insert",
          node: "kpis",
          prop: "cards",
          preset: "stat.noShows",
          position: "end",
          anchor: "",
        },
      ],
    },
    () => "u_fixed",
  );
  expect(r).toEqual({
    kind: "patch",
    summary: "Done",
    ops: [
      { op: "set", node: "appointments", path: ["columns", "revenue", "hidden"], value: true },
      { op: "move", node: "appointments", prop: "columns", key: "status", to: { after: "date" } },
      {
        op: "insert",
        node: "kpis",
        prop: "cards",
        preset: "stat.noShows",
        key: "u_fixed",
        to: "end",
      },
    ],
  });
  if (r.kind === "patch") expect(validate(dashboard, baseSpec, r.ops)).toEqual([]);
});

it("passes through refusals and clarifications", () => {
  expect(
    fromModelOutput({
      kind: "refusal",
      message: "I can only change the layout.",
      category: "data_access",
      ops: [],
    }),
  ).toEqual({
    kind: "refusal",
    reason: "I can only change the layout.",
    category: "data_access",
  });
  // Unknown or missing categories become "other".
  expect(
    fromModelOutput({ kind: "refusal", message: "No.", category: "hack", ops: [] }),
  ).toMatchObject({ category: "other" });
  expect(fromModelOutput({ kind: "clarify", message: "Which table?", ops: [] })).toEqual({
    kind: "clarify",
    question: "Which table?",
  });
  expect(fromModelOutput("garbage")).toEqual({ kind: "patch", ops: [], summary: "" });
});

it("puts the view inside a delimited data block and the request after it", () => {
  const req = buildModelRequest(dashboard, baseSpec, "hide revenue");
  expect(req.system).toContain("not instructions");
  expect(req.user).toMatch(
    /^<current_view>[\s\S]*<\/current_view>\n\n<request>\nhide revenue\n<\/request>$/,
  );
  expect(req.user).toContain('"name": "Appointments table"');
});

it("parses compact answers: values and insert settings arrive as JSON text", () => {
  const r = fromModelOutput(
    {
      kind: "patch",
      message: "ok",
      category: "",
      ops: [
        {
          op: "set",
          node: "appointments",
          prop: "pageSize",
          key: "",
          field: "",
          preset: "",
          position: "",
          anchor: "",
          value_json: "50",
          props_json: "",
        },
        {
          op: "setItem",
          node: "appointments",
          prop: "columns",
          key: "revenue",
          field: "hidden",
          preset: "",
          position: "",
          anchor: "",
          value_json: "true",
          props_json: "",
        },
        {
          op: "set",
          node: "filters",
          prop: "dateRange",
          key: "",
          field: "",
          preset: "",
          position: "",
          anchor: "",
          value_json: '{"relative":"thisWeek"}',
          props_json: "",
        },
        {
          op: "set",
          node: "appointments",
          prop: "pageSize",
          key: "",
          field: "",
          preset: "",
          position: "",
          anchor: "",
          value_json: "not json",
          props_json: "",
        },
      ],
    },
    () => "u_x",
  );
  if (r.kind !== "patch") throw new Error();
  expect(r.ops.slice(0, 3)).toEqual([
    { op: "set", node: "appointments", path: ["pageSize"], value: 50 },
    { op: "set", node: "appointments", path: ["columns", "revenue", "hidden"], value: true },
    { op: "set", node: "filters", path: ["dateRange"], value: { relative: "thisWeek" } },
  ]);
  // Unparseable JSON becomes an invalid op, which the validator rejects (and the model can repair).
  expect(validate(dashboard, baseSpec, [r.ops[3] as never])).toHaveLength(1);
});

it("the system prompt spells out what each prop accepts (needed with the compact schema)", () => {
  const req = buildModelRequest(dashboard, baseSpec, "x");
  expect(req.system).toContain("pageSize (Rows per page): whole number from 10 to 100");
  expect(JSON.stringify(req.compactSchema).length).toBeLessThan(
    JSON.stringify(req.outputSchema).length / 3,
  );
});
