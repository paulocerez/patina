import type Anthropic from "@anthropic-ai/sdk";
import { buildModelRequest } from "@patina-ui/core";
import { describe, expect, it } from "vitest";
import { baseSpec, dashboard } from "../../core/test/fixtures.js";
import { anthropicModel } from "../src/anthropic.js";
import { type ModelAdapter, ModelRefusal, withBackup } from "../src/model.js";

function fakeClient(response: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return response;
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

const request = buildModelRequest(dashboard, baseSpec, "hide revenue");

it("sends a structured-output request with the manifest's schema and parses the JSON answer", async () => {
  const answer = { kind: "patch", message: "ok", ops: [] };
  const { client, calls } = fakeClient({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(answer) }],
  });
  const model = anthropicModel({ client, model: "claude-sonnet-5-5", backupModel: null });
  expect(model.id).toBe("anthropic/claude-sonnet-5-5");
  expect(await model.propose(request)).toEqual(answer);

  const params = calls[0] as {
    model: string;
    output_config: unknown;
    system: unknown[];
    messages: unknown;
    betas: unknown;
    fallbacks: unknown;
  };
  expect(params.model).toBe("claude-sonnet-5-5");
  expect(params.output_config).toEqual({
    effort: "low",
    format: { type: "json_schema", schema: request.outputSchema },
  });
  expect(params.system[0]).toMatchObject({
    type: "text",
    text: request.system,
    cache_control: { type: "ephemeral" },
  });
  expect(params.messages).toEqual([{ role: "user", content: request.user }]);
  expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
  expect(params.fallbacks).toBe("default");
});

it("defaults to Haiku first and Sonnet for the retry", async () => {
  const { client, calls } = fakeClient({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "{}" }],
  });
  const model = anthropicModel({ client });
  expect(model.id).toBe("anthropic/claude-haiku-5-5+anthropic/claude-sonnet-5-5");
  await model.propose(request);
  await model.propose(request, { attempt: 1 });
  expect(calls.map((c) => c.model)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
});

it("leaves out fallbacks for Haiku", async () => {
  const { client, calls } = fakeClient({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "{}" }],
  });
  await anthropicModel({ client, model: "claude-haiku-5-5" }).propose(request);
  expect(calls[0]).not.toHaveProperty("fallbacks");
});

it("turns a safety refusal into a user-facing refusal and rejects truncated output", async () => {
  const refused = fakeClient({ stop_reason: "refusal", content: [] });
  await expect(anthropicModel({ client: refused.client }).propose(request)).rejects.toBeInstanceOf(
    ModelRefusal,
  );
  const cut = fakeClient({
    stop_reason: "max_tokens",
    content: [{ type: "text", text: '{"kind":' }],
  });
  await expect(anthropicModel({ client: cut.client }).propose(request)).rejects.toThrow(
    /max_tokens/,
  );
});

it("falls back to the compact schema when the API can't compile the precise one, and remembers", async () => {
  const sent: unknown[] = [];
  let calls = 0;
  const client = {
    beta: {
      messages: {
        create: async (params: { output_config: { format: { schema: unknown } } }) => {
          calls++;
          sent.push(params.output_config.format.schema);
          if (params.output_config.format.schema === request.outputSchema)
            throw Object.assign(
              new Error(
                '400 {"error":{"message":"The compiled grammar is too large, which would cause performance issues."}}',
              ),
              { status: 400 },
            );
          return {
            stop_reason: "end_turn",
            content: [{ type: "text", text: '{"kind":"clarify","message":"?","ops":[]}' }],
          };
        },
      },
    },
  };
  const model = anthropicModel({ client: client as unknown as Anthropic });
  expect(await model.propose(request)).toMatchObject({ kind: "clarify" });
  expect(sent).toEqual([request.outputSchema, request.compactSchema]);
  await model.propose(request);
  expect(calls).toBe(3); // the second request went straight to the compact schema
  expect(sent[2]).toBe(request.compactSchema);
});

it("doesn't hide other API errors behind the fallback", async () => {
  const client = {
    beta: {
      messages: {
        create: async () =>
          Promise.reject(Object.assign(new Error("401 invalid x-api-key"), { status: 401 })),
      },
    },
  };
  await expect(
    anthropicModel({ client: client as unknown as Anthropic }).propose(request),
  ).rejects.toThrow(/401/);
});

describe("withBackup", () => {
  const fake = (id: string, behave: () => unknown): ModelAdapter & { n: number } => {
    const m = {
      id,
      n: 0,
      async propose() {
        m.n++;
        return behave();
      },
    };
    return m;
  };

  it("routes the repair round-trip to the backup", async () => {
    const a = fake("a", () => "from a");
    const b = fake("b", () => "from b");
    const m = withBackup(a, b);
    expect(await m.propose(request)).toBe("from a");
    expect(await m.propose(request, { attempt: 1 })).toBe("from b");
    expect([a.n, b.n]).toEqual([1, 1]);
  });

  it("uses the backup when the primary errors or declines, but not after an abort", async () => {
    const b = fake("b", () => "from b");
    expect(
      await withBackup(
        fake("a", () => Promise.reject(new Error("overloaded"))),
        b,
      ).propose(request),
    ).toBe("from b");
    expect(
      await withBackup(
        fake("a", () => Promise.reject(new ModelRefusal("no"))),
        b,
      ).propose(request),
    ).toBe("from b");
    const controller = new AbortController();
    controller.abort();
    await expect(
      withBackup(
        fake("a", () => Promise.reject(new Error("aborted"))),
        b,
      ).propose(request, { signal: controller.signal }),
    ).rejects.toThrow("aborted");
  });
});
