# @patina-ui/server

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
