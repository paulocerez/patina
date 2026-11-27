import type { ProposeResponse, SurfaceState } from "@patina-ui/core";
import { expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import { createPatinaHandler, memoryStorage } from "../src/index.js";
import { scriptedModel } from "../src/testing.js";

type Ctx = { userId: string; permissions: string[]; lang?: string };
const model = scriptedModel((_req, prompt) =>
  prompt.includes("delete")
    ? {
        kind: "patch",
        message: "",
        ops: [
          {
            op: "insert",
            node: "kpis",
            prop: "cards",
            preset: "deleteButton",
            position: "end",
            anchor: "",
          },
        ],
      }
    : {
        kind: "patch",
        message: "",
        ops: [
          {
            op: "setItem",
            node: "appointments",
            prop: "columns",
            key: "revenue",
            field: "hidden",
            value: true,
          },
        ],
      },
);

function handler(locale?: (ctx: Ctx) => string | undefined) {
  return createPatinaHandler<Ctx>({
    surfaces: [
      {
        ...dashboard,
        labels: {
          ...dashboard.labels,
          appointments: { en: "Appointments table", de: "Terminliste" },
        },
      },
    ],
    storage: memoryStorage(),
    model,
    getContext: (req) => ({
      userId: "u",
      permissions: ["finance.read"],
      lang: req.headers.get("x-user-lang") ?? undefined,
    }),
    availability: () => ({ customize: true }),
    ...(locale ? { locale } : {}),
    limits: { proposalsPerMinute: 0 },
  });
}

async function ask(h: ReturnType<typeof handler>, prompt: string, headers: Record<string, string>) {
  const res = await h(
    new Request("http://x/surfaces/clinic.dashboard/proposals", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ prompt }),
    }),
  );
  return (await res.json()) as ProposeResponse;
}

it("previews and refuses in the user's language (x-patina-locale, then Accept-Language)", async () => {
  const h = handler();
  const preview = await ask(h, "Umsatz ausblenden", { "x-patina-locale": "de" });
  expect(preview.kind === "proposal" && preview.changes[0]?.text).toBe(
    "„Revenue“ in Terminliste ausblenden",
  );
  expect(model.calls.at(-1)?.user).toContain(
    '<reply_language>German (formal: address the user as "Sie")</reply_language>',
  );

  const refusal = await ask(h, "delete button", { "accept-language": "de-DE,de;q=0.9" });
  expect(refusal).toMatchObject({
    kind: "refusal",
    message: expect.stringMatching(/kann hier nicht hinzugefügt werden/),
  });

  const english = await ask(h, "hide revenue", {});
  expect(english.kind === "proposal" && english.changes[0]?.text).toBe(
    "Hide “Revenue” in Appointments table",
  );
});

it("lets the host decide the locale (e.g. from the user's profile)", async () => {
  const h = handler((ctx) => ctx.lang);
  const r = await ask(h, "hide revenue", { "x-user-lang": "de", "accept-language": "en" });
  expect(r.kind === "proposal" && r.changes[0]?.text).toBe("„Revenue“ in Terminliste ausblenden");
  const state = (await (
    await h(new Request("http://x/surfaces/clinic.dashboard", { headers: { "x-user-lang": "de" } }))
  ).json()) as SurfaceState;
  expect(state.locale).toBe("de");
});

it("translates its own errors", async () => {
  const h = handler();
  const res = await h(
    new Request("http://x/surfaces/clinic.dashboard/proposals", {
      method: "POST",
      headers: { "content-type": "application/json", "x-patina-locale": "de" },
      body: JSON.stringify({ prompt: "   " }),
    }),
  );
  expect(((await res.json()) as { error: { message: string } }).error.message).toBe(
    "Beschreiben Sie, was Sie ändern möchten.",
  );
});
