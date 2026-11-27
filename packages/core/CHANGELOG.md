# @patina-ui/core

## 0.4.1

### Patch Changes

- [`e87777d`](https://github.com/paulocerez/patina/commit/e87777d5e2a8e3feae964e71e796c0fdc3770b79) Thanks [@paulocerez](https://github.com/paulocerez)! - Published with npm provenance: npm now shows that each version was built by this repository's release workflow, from a specific commit.

## 0.4.0

### Minor Changes

- [`ff974af`](https://github.com/paulocerez/patina/commit/ff974af6e03da79bdb3d80cad2e8837e985216bd) Thanks [@paulocerez](https://github.com/paulocerez)! - Easier to add to an existing app.
  
  - **CommonJS:** every package also ships a CommonJS build with types, so `require` and TypeScript's `moduleResolution: node` work without loaders or type shims.
  - **Existing pages keep their JSX:** `useSlot`, `useCollection` and `useSurfaceProp` return the order, visibility and options for a page that renders itself, with the page's defaults while loading or without a provider.
  - **Only the tables you use:** `postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })` needs just `patina_history`; `postgresSchema(features)` and `migratePostgres(query, features)` match. `@patina-ui/server/drizzle` exports the tables for Drizzle, identical to the SQL.
  - **No API key, no problem:** `anthropicModel()` no longer needs a key at startup; without one, customizing is off with a short message. `@anthropic-ai/sdk` 0.90+ is supported.
  - **Cross-origin APIs:** `<PatinaProvider credentials="include" params={{ accountId }}>`, and the locale is sent as a query parameter, so no CORS change is needed.

## 0.3.0

### Minor Changes

- [`79af33d`](https://github.com/paulocerez/patina/commit/79af33dd8be9b8214636e9f1ea83ae53604e6940) Thanks [@paulocerez](https://github.com/paulocerez)! - Follow-ups and integrations.
  
  - **Follow-ups** (`@patina-ui/server/followups`, `patina followups`): turn what customers asked for but couldn't do into issues in Linear, GitHub or Jira (one per request; repeats become comments), a Slack digest, HubSpot notes for account managers, or your own webhook. Prompts are redacted first. `anthropicGrouper` merges requests across wordings and languages and writes the titles.
  - **Shipped notices:** when the issue is completed (`followUpWebhook` for Linear, GitHub and Jira, or `patina followups ship`), the users who asked see a notice on that page: `<ShippedNotice>`, `useSurface().notices`. Needs the new `patina_followups` table: run `migratePostgres` again or add it to your migrations.
  - **Analytics and errors** (`@patina-ui/server/integrations`): `posthogEvents`, `sentryReporter`, `combineEvents` for `onEvent` and `onError`.

## 0.2.0

### Minor Changes

- [`9d0bbc9`](https://github.com/paulocerez/patina/commit/9d0bbc9975fe19d4b8e75370052f3c0019ae2aa8) Thanks [@paulocerez](https://github.com/paulocerez)! - German, and a better `patina scan` on Express apps.
  
  - **Localization:** Patina's messages, change previews, value names, data-view titles and UI defaults now come in English and German (formal "Sie"), and the model replies in the user's language. The locale comes from `<PatinaProvider locale>` (default: the browser's language), the server's `locale` hook, or `Accept-Language`. Labels can be given per language: `label: { en: "Orders", de: "Bestellungen" }`. New: `usePatinaText()`, `localizeManifest`, `msg`, `pickLocale`, `tx`.
  - **`patina scan`** follows routers mounted under prefixes (`app.use("/api/calls", callsRouter)`, nested routers, `require`, `module.exports`), and reads one-line TypeScript interfaces. Generated data blocks use `usePatinaText()` for their texts and number formatting.
  - **Default model:** Claude Haiku 5.5 with Sonnet 5.5 as backup (`withBackup`), plus a compact output schema fallback for large surfaces.
  - **Fixes:** reset on an unchanged view no longer writes history; clearer messages.
