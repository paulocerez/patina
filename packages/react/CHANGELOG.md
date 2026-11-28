# @patina-ui/react

## 0.7.0

### Minor Changes

- [#9](https://github.com/paulocerez/patina/pull/9) [`1ab6dc1`](https://github.com/paulocerez/patina/commit/1ab6dc1c98aab4a967beabc5692066cd4b876afe) Thanks [@paulocerez](https://github.com/paulocerez)! - Reliable on real prompts. Every problem here came from the first real host's prompts; every new check is deterministic and tested.
  
  - **Never refuse what the manifest allows:** every model refusal except `safety` gets one more look by the backup model, together with the refusal and the relevant part of the manifest (allowed values with labels in the user's language, collection keys, presets, data fields). A deterministic guard then checks each of the model's refusals: if the prompt names an allowed value of a setting it is about ("Standard-Zeitraum auf Heute setzen"), or a hidden column of a table it names, Patina proposes it or asks which one. Rescues are logged as source `guard`, reason `rescued:<category>`, and listed in insights so they can become eval cases. Calls per request stay at 2 or fewer.
  - **Answers instead of refusals:** questions such as "Was kann ich bei den letzten Anrufen anzeigen?" or "Which columns can I add?" get a new response, `{ kind: "answer", message, capabilities }`, built from the same data as `useCapabilities` and scoped to the part of the page named. There is no model call, and the outcome `answered` goes to `onEvent` and insights. The response also carries `question`, so clients before 0.7 show it.
  - **Clarifications only offer what's possible:** each option the model offers carries its ops, and options that don't validate are dropped. The reply goes back with the original request and the question (`thread` on `POST …/proposals`). A reply can't get a second question.
  - **Refusal categories a developer can act on:** new categories `missing_field`, `missing_setting` and `missing_value`, plus `safety`. Each comes with structured `detail: { node, component, wanted, field? }`, checked against the manifest and stored with the request (new `detail` column; run `migratePostgres` again). Insights gain "Suggested manifest changes" (e.g. "Add a `summary` column to RecentCallsTable"), and follow-ups group by detail, so different wordings of the same missing thing count together.
  - **Undo can't run away:** `SurfaceState.seq` and `canRedo`. Undo, redo and reset accept `{ expectedSeq }`; a stale one answers 409 instead of undoing one more step. There is a new `POST …/redo` (undo of an undo) and a `<RedoButton>`, and the React store ignores history actions while a request is in flight.
  - **`privacy: "display"` for catalog fields:** for values users already see elsewhere in the app. These fields can be shown as table columns and are listed in capabilities, but can't be filtered, grouped, sorted or aggregated, and their values never reach the model. `sensitive: true` keeps its meaning (`privacy: "never"`).
  - **Observability:** the handler warns once at startup when the request log is off and no `onEvent` is set. The docs explain that `logRequests: false` / `requestLog: false` hides every prompt. PostHog events gain `detail_node` and `detail_wanted`.
  - **`<SurfaceMessage>`:** renders answers as a list and clarify options as buttons, and shows `message` for unknown reply kinds.
  - **Evals:** `EvalCase` gains `answer`, refusal `category`/`detail`, clarify `optionsMin`/`optionsMax`, `thread` and `script`. `runEval(…, { scripted: true })` replays recorded model answers. The new `evals/real-de.jsonl` holds the first host's 19 German prompts against a host-shaped fixture, scripted in CI. Run it live with `PATINA_LIVE_EVAL=1` or `pnpm eval --surface calls --cases real-de.jsonl`.

- [#8](https://github.com/paulocerez/patina/pull/8) [`79144f3`](https://github.com/paulocerez/patina/commit/79144f31a076016e5f40a1a6cc910822fafcc9e8) Thanks [@paulocerez](https://github.com/paulocerez)! - Less hand work per app: the scan understands layered backends, and fetching is configured instead of written.
  
  - **Scan:** follows handlers passed by reference (`router.get("/", controller.list)`) into their bodies, the helpers they hand `req` to, and the return types of the services they call, including class methods and wrapped lists (`Promise<{ items: T[]; total }>`). It prefers row types near the route over same-named ones elsewhere, resolves exported string-literal unions to enums, keeps tenant path placeholders (`/accounts/:accountId/…`), and notes paging, date-range params and the rows' key. More personal fields are flagged (caller numbers, person names, notes, comments, transcripts).
  - **`patina/fetch.ts`:** the scan drafts a `fetchSource` from what it found, and the catalog draft suggests derived fields (weekday, hour, ranges).
  - **`createFetchSource`** (react): another origin, tenant params and path placeholders, rows inside an envelope, offset/page/cursor paging (pages fetched in order, capped by `maxPages`), and relative date ranges mapped to the endpoint's own params.
  - **`rangeBounds`, `asRelativeRange`** (core): a relative range as two dates.

### Patch Changes

- Updated dependencies [[`1ab6dc1`](https://github.com/paulocerez/patina/commit/1ab6dc1c98aab4a967beabc5692066cd4b876afe), [`79144f3`](https://github.com/paulocerez/patina/commit/79144f31a076016e5f40a1a6cc910822fafcc9e8)]:
  - @patina-ui/core@0.7.0

## 0.6.0

### Minor Changes

- [#6](https://github.com/paulocerez/patina/pull/6) [`98ef884`](https://github.com/paulocerez/patina/commit/98ef8842a2092d0ba517f3b8fccd017e6e4ab16b) Thanks [@paulocerez](https://github.com/paulocerez)! - Answer more of what users ask for, without new endpoints.
  
  - **Derived fields:** `f.weekday`, `f.hour`, `f.ranges` and `f.contains` compute a field in the browser from another field of the row ("calls by weekday", "short vs. long", "emergencies"). They are declarative and group, filter and display like enums and yes/no fields, in their natural order.
  - **Values per tenant:** `restrict` may be async and return `values: { "source.field": [...] }`. For that request the text field becomes an enum of this tenant's values, so views can filter on it and the model knows the names.
  - **Per-view params:** a source param with `choices` lets a single view pick its own value (`query.params`, e.g. a card for "this week" on a page that defaults to 30 days). The model sees the choices, and the view's title names the one picked.
  - **Optional columns and sections:** `useSlot`, `useSlotItems` and `useCollection` take `{ hidden: [...] }` for keys your page knows but the base spec hides. They stay out of the fallback (no provider, loading) and appear once a user shows them.
  - **Fix:** `anthropicModel`'s `"auto"` schema mode now also falls back to the compact schema on "too many parameters with union types", which large catalogs and dashboards with several data blocks hit.

### Patch Changes

- Updated dependencies [[`98ef884`](https://github.com/paulocerez/patina/commit/98ef8842a2092d0ba517f3b8fccd017e6e4ab16b)]:
  - @patina-ui/core@0.6.0

## 0.5.0

### Minor Changes

- [`d12a1e0`](https://github.com/paulocerez/patina/commit/d12a1e00cccf71637cb7e3442aa8e54e9568823a) Thanks [@paulocerez](https://github.com/paulocerez)! - Data views on pages that render themselves, and users can see what they can ask for.
  
  - **Data views with the hooks:** `useSlotItems` returns a slot's own sections plus the blocks users added (`{ kind: "host", key } | { kind: "block", key, node }`), and `<PatinaBlock>` renders a block with the data context `useQuery` needs, so tables, charts and numbers work without `<Surface>`. Previews show new blocks in place; unknown host keys are still dropped. `<SurfaceScope>` gives your own components the same context. `useSlot` is unchanged.
  - **What you can ask for:** every `SurfaceState` carries `capabilities` (what can be rearranged, hidden or added, settings with their values, and data sources with their fields), built from the user's restricted manifest and public catalog in their language. Sensitive fields never appear. React: `useCapabilities(surfaceId)` and the headless `<Capabilities>` (a list, or example prompts via its render prop). Core: `capabilities`, `capabilityLines`, `capabilityHint`, `capabilityExamples`.
  - **Better refusals:** `data_access` and `not_on_page` refusals end with what is available, from the same data (not written by the model): the data sources and fields when there is a catalog, otherwise the parts of the page that can change.
  - **German replies use "Sie":** the model is told to address German-speaking users formally, matching Patina's own German texts.

### Patch Changes

- Updated dependencies [[`d12a1e0`](https://github.com/paulocerez/patina/commit/d12a1e00cccf71637cb7e3442aa8e54e9568823a)]:
  - @patina-ui/core@0.5.0

## 0.4.1

### Patch Changes

- [`e87777d`](https://github.com/paulocerez/patina/commit/e87777d5e2a8e3feae964e71e796c0fdc3770b79) Thanks [@paulocerez](https://github.com/paulocerez)! - Published with npm provenance: npm now shows that each version was built by this repository's release workflow, from a specific commit.
- Updated dependencies [[`e87777d`](https://github.com/paulocerez/patina/commit/e87777d5e2a8e3feae964e71e796c0fdc3770b79)]:
  - @patina-ui/core@0.4.1

## 0.4.0

### Minor Changes

- [`ff974af`](https://github.com/paulocerez/patina/commit/ff974af6e03da79bdb3d80cad2e8837e985216bd) Thanks [@paulocerez](https://github.com/paulocerez)! - Easier to add to an existing app.
  
  - **CommonJS:** every package also ships a CommonJS build with types, so `require` and TypeScript's `moduleResolution: node` work without loaders or type shims.
  - **Existing pages keep their JSX:** `useSlot`, `useCollection` and `useSurfaceProp` return the order, visibility and options for a page that renders itself, with the page's defaults while loading or without a provider.
  - **Only the tables you use:** `postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })` needs just `patina_history`; `postgresSchema(features)` and `migratePostgres(query, features)` match. `@patina-ui/server/drizzle` exports the tables for Drizzle, identical to the SQL.
  - **No API key, no problem:** `anthropicModel()` no longer needs a key at startup; without one, customizing is off with a short message. `@anthropic-ai/sdk` 0.90+ is supported.
  - **Cross-origin APIs:** `<PatinaProvider credentials="include" params={{ accountId }}>`, and the locale is sent as a query parameter, so no CORS change is needed.

### Patch Changes

- Updated dependencies [[`ff974af`](https://github.com/paulocerez/patina/commit/ff974af6e03da79bdb3d80cad2e8837e985216bd)]:
  - @patina-ui/core@0.4.0

## 0.3.0

### Minor Changes

- [`79af33d`](https://github.com/paulocerez/patina/commit/79af33dd8be9b8214636e9f1ea83ae53604e6940) Thanks [@paulocerez](https://github.com/paulocerez)! - Follow-ups and integrations.
  
  - **Follow-ups** (`@patina-ui/server/followups`, `patina followups`): turn what customers asked for but couldn't do into issues in Linear, GitHub or Jira (one per request; repeats become comments), a Slack digest, HubSpot notes for account managers, or your own webhook. Prompts are redacted first. `anthropicGrouper` merges requests across wordings and languages and writes the titles.
  - **Shipped notices:** when the issue is completed (`followUpWebhook` for Linear, GitHub and Jira, or `patina followups ship`), the users who asked see a notice on that page: `<ShippedNotice>`, `useSurface().notices`. Needs the new `patina_followups` table: run `migratePostgres` again or add it to your migrations.
  - **Analytics and errors** (`@patina-ui/server/integrations`): `posthogEvents`, `sentryReporter`, `combineEvents` for `onEvent` and `onError`.

### Patch Changes

- Updated dependencies [[`79af33d`](https://github.com/paulocerez/patina/commit/79af33dd8be9b8214636e9f1ea83ae53604e6940)]:
  - @patina-ui/core@0.3.0

## 0.2.0

### Minor Changes

- [`9d0bbc9`](https://github.com/paulocerez/patina/commit/9d0bbc9975fe19d4b8e75370052f3c0019ae2aa8) Thanks [@paulocerez](https://github.com/paulocerez)! - German, and a better `patina scan` on Express apps.
  
  - **Localization:** Patina's messages, change previews, value names, data-view titles and UI defaults now come in English and German (formal "Sie"), and the model replies in the user's language. The locale comes from `<PatinaProvider locale>` (default: the browser's language), the server's `locale` hook, or `Accept-Language`. Labels can be given per language: `label: { en: "Orders", de: "Bestellungen" }`. New: `usePatinaText()`, `localizeManifest`, `msg`, `pickLocale`, `tx`.
  - **`patina scan`** follows routers mounted under prefixes (`app.use("/api/calls", callsRouter)`, nested routers, `require`, `module.exports`), and reads one-line TypeScript interfaces. Generated data blocks use `usePatinaText()` for their texts and number formatting.
  - **Default model:** Claude Haiku 5.5 with Sonnet 5.5 as backup (`withBackup`), plus a compact output schema fallback for large surfaces.
  - **Fixes:** reset on an unchanged view no longer writes history; clearer messages.

### Patch Changes

- Updated dependencies [[`9d0bbc9`](https://github.com/paulocerez/patina/commit/9d0bbc9975fe19d4b8e75370052f3c0019ae2aa8)]:
  - @patina-ui/core@0.2.0
