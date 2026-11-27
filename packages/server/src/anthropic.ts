/**
 * Anthropic model adapter.
 * @packageDocumentation
 * @module @patina-ui/server/anthropic
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ModelRequest } from "@patina-ui/core";
import { type ModelAdapter, ModelRefusal, withBackup } from "./model.js";

export interface AnthropicModelOptions {
  /** Defaults to `new Anthropic()`, which reads ANTHROPIC_API_KEY (or an `ant auth login` profile). */
  client?: Anthropic;
  apiKey?: string;
  /**
   * The model that answers first. Default "claude-haiku-5-5": fast and inexpensive, and with the
   * backup below it matched the larger models on the eval set.
   */
  model?: string;
  /**
   * The model for the repair round-trip (when the first answer doesn't validate) and for when
   * the first model errors or declines. Default "claude-sonnet-5-5". `null` uses `model` only.
   */
  backupModel?: string | null;
  /** Default "low": the task is small and tightly constrained, and latency matters. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Default 4096. */
  maxTokens?: number;
  /**
   * Server-side refusal fallback ("default" routes by refusal category). Default: on for
   * models that support it (not Haiku). Set to false on Bedrock, Vertex and Foundry.
   */
  fallbacks?: boolean;
  /**
   * Which output schema to send. "auto" (default) sends the precise schema and switches to the
   * compact one if the API can't compile it (large surfaces); "precise" or "compact" force one.
   */
  schema?: "auto" | "precise" | "compact";
}

const GRAMMAR_TOO_LARGE =
  /grammar is too large|schema is too (large|complex)|too many (strict )?(tools|schemas)/i;

/**
 * Anthropic implementation of `ModelAdapter`, using structured outputs with the JSON Schema
 * compiled from the manifest. Runs server-side only: the API key never reaches the browser.
 *
 * By default Claude Haiku 5.5 answers and Claude Sonnet 5.5 is the backup (see `backupModel`).
 */
export function anthropicModel(options: AnthropicModelOptions = {}): ModelAdapter {
  const client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  const primary = singleModel(client, options.model ?? "claude-haiku-5-5", options);
  const backupId = options.backupModel === undefined ? "claude-sonnet-5-5" : options.backupModel;
  if (!backupId || backupId === (options.model ?? "claude-haiku-5-5")) return primary;
  return withBackup(primary, singleModel(client, backupId, options));
}

function singleModel(
  client: Anthropic,
  model: string,
  options: AnthropicModelOptions,
): ModelAdapter {
  const useFallbacks = options.fallbacks ?? !model.includes("haiku");

  // Surfaces whose precise schema the API couldn't compile (keyed by the schema's size and
  // node list, cheap and stable): they go straight to the compact schema next time.
  const tooLarge = new Set<string>();
  const mode = options.schema ?? "auto";

  async function call(
    request: ModelRequest,
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    return client.beta.messages.create(
      {
        model,
        max_tokens: options.maxTokens ?? 4096,
        // The system prompt (rules + manifest) is identical across users of a surface.
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: request.user }],
        output_config: {
          effort: options.effort ?? "low",
          format: { type: "json_schema", schema },
        },
        ...(useFallbacks
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
      },
      { signal },
    );
  }

  return {
    id: `anthropic/${model}`,
    async propose(request: ModelRequest, opts) {
      const key = JSON.stringify(request.outputSchema).length.toString();
      const compact = mode === "compact" || (mode === "auto" && tooLarge.has(key));
      let response: Awaited<ReturnType<typeof call>>;
      try {
        response = await call(
          request,
          compact ? request.compactSchema : request.outputSchema,
          opts?.signal,
        );
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (
          mode !== "auto" ||
          compact ||
          status !== 400 ||
          !GRAMMAR_TOO_LARGE.test(String((e as Error).message))
        )
          throw e;
        tooLarge.add(key);
        response = await call(request, request.compactSchema, opts?.signal);
      }

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
