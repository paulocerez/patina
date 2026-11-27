import type { ProposeResponse, SurfaceState } from "@patina-ui/core";
import { describe, expect, it } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import { dashboard } from "../../core/test/fixtures.js";
import { createPatinaHandler, memoryStorage } from "../src/index.js";

type Ctx = { userId: string; permissions: string[] };
const users: Record<string, Ctx> = {
  finance: { userId: "f", permissions: ["finance.read"] },
  staff: { userId: "s", permissions: [] },
};

function handler(
  surface: typeof dataSurface | typeof dashboard,
  answer: unknown,
  rule: { customize?: boolean; dataViews?: boolean } = {},
) {
  return createPatinaHandler<Ctx>({
    surfaces: [surface as typeof dataSurface],
    storage: memoryStorage(),
    model: { id: "m", propose: async () => answer },
    basePath: "/api",
    getContext: (req) => users[req.headers.get("x-user") ?? ""] ?? null,
    availability: () => rule,
  });
}

const get = async (h: ReturnType<typeof handler>, id: string, user: string, locale = "en") =>
  (await (
    await h(
      new Request(`http://x/api/surfaces/${id}?locale=${locale}`, { headers: { "x-user": user } }),
    )
  ).json()) as SurfaceState;

const ask = async (h: ReturnType<typeof handler>, id: string, user: string, locale = "en") =>
  (await (
    await h(
      new Request(`http://x/api/surfaces/${id}/proposals?locale=${locale}`, {
        method: "POST",
        headers: { "x-user": user, "content-type": "application/json" },
        body: JSON.stringify({ prompt: "show revenue per vet" }),
      }),
    )
  ).json()) as ProposeResponse;

const refusal = (category: string) => ({
  kind: "refusal",
  message: "That isn't on this page.",
  category,
  ops: [],
});

describe("capabilities in the surface state", () => {
  it("follow the user's permissions and never include sensitive fields", async () => {
    const h = handler(dataSurface, refusal("other"));
    const finance = (await get(h, "data", "finance")).capabilities;
    const staff = (await get(h, "data", "staff")).capabilities;
    const fields = (c: typeof staff) =>
      c?.data.find((d) => d.source === "appointments")?.fields.map((f) => f.field);
    expect(fields(finance)).toContain("revenue");
    expect(fields(staff)).not.toContain("revenue");
    expect(JSON.stringify(finance)).not.toContain("ownerPhone");
    expect(JSON.stringify(staff)).not.toContain("ownerPhone");
  });

  it("drop data when data views are off, and are absent when customizing is off", async () => {
    expect(
      (await get(handler(dataSurface, null, { dataViews: false }), "data", "staff")).capabilities
        ?.data,
    ).toEqual([]);
    expect(
      (await get(handler(dataSurface, null, { customize: false }), "data", "staff")).capabilities,
    ).toBeUndefined();
  });
});

describe("refusals say what is possible", () => {
  it("data_access with a catalog names the data that can be added", async () => {
    const r = await ask(handler(dataSurface, refusal("data_access")), "data", "staff");
    expect(r).toMatchObject({ kind: "refusal" });
    expect((r as { message: string }).message).toBe(
      "That isn't on this page. You can add tables, charts and numbers from Appointments (Date, Vet, Status, Owner) and Invoices (Amount, Customer).",
    );
  });

  it("not_on_page without a catalog names the parts of the page, in German", async () => {
    const r = await ask(
      handler(dashboard, refusal("not_on_page")),
      "clinic.dashboard",
      "finance",
      "de",
    );
    const message = (r as { message: string }).message;
    expect(message.startsWith("That isn't on this page. Hier können Sie ")).toBe(true);
    expect(message).toContain("umordnen oder ausblenden");
  });

  it("other refusals are left as the model wrote them", async () => {
    const r = await ask(handler(dataSurface, refusal("action")), "data", "staff");
    expect((r as { message: string }).message).toBe("That isn't on this page.");
  });
});
