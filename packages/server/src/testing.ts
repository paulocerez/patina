/**
 * Test helpers.
 * @packageDocumentation
 * @module @patina-ui/server/testing
 */
import type { ModelRequest } from "@patina-ui/core";
import type { ModelAdapter } from "./model.js";

/**
 * A model that returns scripted answers, for tests and offline demos.
 * Each answer is raw model output: `{ kind, message, ops }` in the flattened op format.
 */
export function scriptedModel(
  answer: (request: ModelRequest, prompt: string, call: number) => unknown,
): ModelAdapter & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  return {
    id: "scripted",
    calls,
    async propose(request) {
      calls.push(request);
      const prompt = /<request>\n([\s\S]*?)\n<\/request>/.exec(request.user)?.[1] ?? "";
      return answer(request, prompt, calls.length);
    },
  };
}
