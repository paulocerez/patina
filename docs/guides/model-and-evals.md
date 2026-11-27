# Model and evals

## How the model is used

Each request makes one structured-output call, plus at most one repair call:

1. Core builds the prompt with `buildModelRequest(manifest, spec, prompt)`:
   - **system**: the rules, plus your surface, component, prop and preset descriptions.
     This is identical for every user of a surface, so it is prompt-cached.
   - **user**: the current view's structure inside `<current_view>` (marked as data),
     then the request.
   - **outputSchema**: compiled from the user's restricted manifest. Node IDs, keys,
     presets and enum values are all enumerated.
2. The answer (`{ kind: "patch" | "refusal" | "clarify", message, ops }`) is validated.
   If it's invalid, the validator's messages go back to the model once. If it's still
   invalid, the user gets the validator's message as a refusal.

**Descriptions matter.** The model only knows what your manifest says. Good `description`s
and `labels` (_"Appointments table"_, _"Default date range"_) are the main lever for accuracy.

## Choosing a model

`anthropicModel()` defaults to `claude-opus-5-5` at `effort: "low"`. Try others with the
eval set before switching:

```ts
anthropicModel({ model: "claude-sonnet-5-5" });
anthropicModel({ model: "claude-haiku-5-5" }); // cheapest and fastest; check its refusal accuracy
```

Other providers: implement `ModelAdapter` (see [Server setup](server-setup.md#the-model)).

## The eval set

`evals/dashboard.jsonl` holds 58 cases against the demo surface: columns, layout, filters,
table settings, chart, presets, multi-part requests, refusals, a user with restricted
permissions, history-dependent prompts, ambiguous prompts, and [data views](data-views.md): new charts, number cards and columns, plus refusals for sensitive or restricted fields.

```json
{"id":"cols-move-1","user":"alice","prompt":"Move status right after date","expect":{"kind":"patch","ops":[{"op":"move","node":"appointments","prop":"columns","key":"status","to":{"after":"date"}}]}}
{"id":"refuse-1","user":"alice","prompt":"Show me other users' appointments","expect":{"kind":"refusal"}}
{"id":"clarify-2","user":"alice","prompt":"hide it","expect":{"kind":"clarify"},"accept":["clarify","refusal"]}
```

| Field     |                                                    |
| --------- | -------------------------------------------------- |
| `user`    | which demo user (permissions differ)               |
| `history` | patches (op lists) already saved before the prompt |
| `expect`  | `patch` with ops, `refusal` or `clarify`           |
| `accept`  | other outcomes that also pass                      |

**Scoring compares the resulting view, not the ops.** `after: "date"` and `before:
"patient"` are both correct if they produce the same order. Cases run through the real
handler, so restriction, validation and the repair round-trip are all included.

### Running it

```sh
pnpm eval --model offline                  # free baseline: the demo's keyword matcher
ANTHROPIC_API_KEY=… pnpm eval              # default model (costs money: ~58 cases × 1–2 calls)
ANTHROPIC_API_KEY=… pnpm eval --model claude-haiku-5-5 --concurrency 8
pnpm eval --model offline --filter refuse  # a subset by id
```

The report shows:

- accuracy, overall and per expected outcome;
- refusal precision and recall;
- the repair rate;
- errors;
- p50/p95 latency.

Full results go to `evals/results/<timestamp>.json`.

### Your own surfaces

```ts
import { runEval } from "@patina-ui/server/eval";

const { results, summary } = await runEval(cases, {
  surface: orders,
  model: anthropicModel(),
  contexts: { admin: { userId: "a", roles: ["admin"] }, viewer: { userId: "v", roles: [] } },
});
```

Write cases from prompts your users actually type. Re-run whenever you change descriptions,
prompts, the model or the manifest.
