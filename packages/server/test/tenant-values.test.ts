import type { SurfaceState } from "@patina-ui/core";
import { expect, it } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import { createPatinaHandler, memoryStorage } from "../src/index.js";

it("an async restrict can give this tenant's values for a text field, which then filter like an enum", async () => {
  let schema = "";
  const handler = createPatinaHandler<{ userId: string; tenantId: string; permissions: string[] }>({
    surfaces: [
      {
        ...dataSurface,
        restrict: async (ctx) => ({
          values: { "appointments.vet": ctx.tenantId === "t1" ? ["Dr. A", "Dr. B"] : [] },
        }),
      },
    ],
    storage: memoryStorage(),
    basePath: "/api",
    model: {
      id: "m",
      propose: async (req) => {
        schema = JSON.stringify(req.outputSchema);
        return { kind: "clarify", message: "?" };
      },
    },
    getContext: (req) => ({
      userId: "u",
      tenantId: req.headers.get("x-tenant") ?? "",
      permissions: [],
    }),
  });
  const state = async (tenant: string) =>
    (await (
      await handler(new Request("http://x/api/surfaces/data", { headers: { "x-tenant": tenant } }))
    ).json()) as SurfaceState;

  expect((await state("t1")).catalog?.sources.appointments?.fields.vet).toMatchObject({
    kind: "enum",
    values: ["Dr. A", "Dr. B"],
  });
  expect((await state("t2")).catalog?.sources.appointments?.fields.vet?.kind).toBe("string");

  await handler(
    new Request("http://x/api/surfaces/data/proposals", {
      method: "POST",
      headers: { "x-tenant": "t1", "content-type": "application/json" },
      body: JSON.stringify({ prompt: "appointments of Dr. B" }),
    }),
  );
  // "vet" is now filterable: it appears among the where-fields of the query schema.
  expect(schema).toMatch(/"field":\{"type":"string","enum":\[[^\]]*"vet"/);
});
