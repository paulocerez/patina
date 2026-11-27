import type Anthropic from "@anthropic-ai/sdk";
import { buildModelRequest } from "@patina/core";
import { expect, it } from "vitest";
import { baseSpec, dashboard } from "../../core/test/fixtures.js";
import { anthropicModel } from "../src/anthropic.js";
import { ModelRefusal } from "../src/model.js";

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
  const model = anthropicModel({ client });
  expect(model.id).toBe("anthropic/claude-opus-5-5");
  expect(await model.propose(request)).toEqual(answer);

  const params = calls[0] as {
    model: string;
    output_config: unknown;
    system: unknown[];
    messages: unknown;
    betas: unknown;
    fallbacks: unknown;
  };
  expect(params.model).toBe("claude-opus-5-5");
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
