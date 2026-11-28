---

"@patina-ui/core": minor
"@patina-ui/server": minor
"@patina-ui/react": minor
"@patina-ui/cli": minor
---

Reliable on real prompts. Every problem here came from the first real host's prompts; every new check is deterministic and tested.

- **Never refuse what the manifest allows:** every model refusal except `safety` gets one more look by the backup model, together with the refusal and the relevant part of the manifest (allowed values with labels in the user's language, collection keys, presets, data fields). A deterministic guard then checks each of the model's refusals: if the prompt names an allowed value of a setting it is about ("Standard-Zeitraum auf Heute setzen"), or a hidden column of a table it names, Patina proposes it or asks which one. Rescues are logged as source `guard`, reason `rescued:<category>`, and listed in insights so they can become eval cases. Calls per request stay at 2 or fewer.
- **Answers instead of refusals:** questions such as "Was kann ich bei den letzten Anrufen anzeigen?" or "Which columns can I add?" get a new response, `{ kind: "answer", message, capabilities }`, built from the same data as `useCapabilities` and scoped to the part of the page named. There is no model call, and the outcome `answered` goes to `onEvent` and insights. The response also carries `question`, so clients before 0.7 show it.
- **Clarifications only offer what's possible:** each option the model offers carries its ops, and options that don't validate are dropped. The reply goes back with the original request and the question (`thread` on `POST …/proposals`). A reply can't get a second question.
- **Refusal categories a developer can act on:** new categories `missing_field`, `missing_setting` and `missing_value`, plus `safety`. Each comes with structured `detail: { node, component, wanted, field? }`, checked against the manifest and stored with the request (new `detail` column; run `migratePostgres` again). Insights gain "Suggested manifest changes" (e.g. "Add a `summary` column to RecentCallsTable"), and follow-ups group by detail, so different wordings of the same missing thing count together.
- **Undo can't run away:** `SurfaceState.seq` and `canRedo`. Undo, redo and reset accept `{ expectedSeq }`; a stale one answers 409 instead of undoing one more step. There is a new `POST …/redo` (undo of an undo) and a `<RedoButton>`, and the React store ignores history actions while a request is in flight.
- **`privacy: "display"` for catalog fields:** for values users already see elsewhere in the app. These fields can be shown as table columns and are listed in capabilities, but can't be filtered, grouped, sorted or aggregated, and their values never reach the model. `sensitive: true` keeps its meaning (`privacy: "never"`).
- **Observability:** the handler warns once at startup when the request log is off and no `onEvent` is set. The docs explain that `logRequests: false` / `requestLog: false` hides every prompt. PostHog events gain `detail_node` and `detail_wanted`.
- **`<SurfaceMessage>`:** renders answers as a list and clarify options as buttons, and shows `message` for unknown reply kinds.
- **Evals:** `EvalCase` gains `answer`, refusal `category`/`detail`, clarify `optionsMin`/`optionsMax`, `thread` and `script`. `runEval(…, { scripted: true })` replays recorded model answers. The new `evals/real-de.jsonl` holds the first host's 19 German prompts against a host-shaped fixture, scripted in CI. Run it live with `PATINA_LIVE_EVAL=1` or `pnpm eval --surface calls --cases real-de.jsonl`.
