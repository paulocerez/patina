/**
 * Anthropic model adapter.
 * @packageDocumentation
 * @module @patina-ui/server/anthropic
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ModelRequest } from "@patina-ui/core";
import { type ModelAdapter, ModelRefusal } from "./model.js";

export interface AnthropicModelOptions {
  /** Defaults to `new Anthropic()`, which reads ANTHROPIC_API_KEY (or an `ant auth login` profile). */
  client?: Anthropic;
  apiKey?: string;
  /** Default "claude-opus-5-5". Use the eval set to compare models for your surfaces. */
  model?: string;
  /** Default "low": the task is small and tightly constrained, and latency matters. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Default 4096. */
  maxTokens?: number;
  /**
   * Server-side refusal fallback ("default" routes by refusal category). Default: on for
   * models that support it (not Haiku). Set to false on Bedrock, Vertex and Foundry.
   */
  fallbacks?: boolean;
}

/**
 * Anthropic implementation of `ModelAdapter`, using structured outputs with the JSON Schema
 * compiled from the manifest. Runs server-side only: the API key never reaches the browser.
 */
export function anthropicModel(options: AnthropicModelOptions = {}): ModelAdapter {
  const client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  const model = options.model ?? "claude-opus-5-5";
  const useFallbacks = options.fallbacks ?? !model.includes("haiku");

  return {
    id: `anthropic/${model}`,
    async propose(request: ModelRequest, opts) {
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: options.maxTokens ?? 4096,
          // The system prompt (rules + manifest) is identical across users of a surface.
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: request.user }],
          output_config: {
            effort: options.effort ?? "low",
            format: { type: "json_schema", schema: request.outputSchema },
          },
          ...(useFallbacks
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
        },
        { signal: opts?.signal },
      );

      if (response.stop_reason === "refusal") {
        throw new ModelRefusal("I can't help with that request here.");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("Model output was cut off (max_tokens)");
      }
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new Error("Model returned invalid JSON");
      }
    },
  };
}
