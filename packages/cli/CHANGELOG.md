# @patina-ui/cli

## 0.6.0

### Patch Changes

- Updated dependencies [[`98ef884`](https://github.com/paulocerez/patina/commit/98ef8842a2092d0ba517f3b8fccd017e6e4ab16b)]:
  - @patina-ui/core@0.6.0
  - @patina-ui/server@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`d12a1e0`](https://github.com/paulocerez/patina/commit/d12a1e00cccf71637cb7e3442aa8e54e9568823a)]:
  - @patina-ui/core@0.5.0
  - @patina-ui/server@0.5.0

## 0.4.1

### Patch Changes

- [`e87777d`](https://github.com/paulocerez/patina/commit/e87777d5e2a8e3feae964e71e796c0fdc3770b79) Thanks [@paulocerez](https://github.com/paulocerez)! - Published with npm provenance: npm now shows that each version was built by this repository's release workflow, from a specific commit.
- Updated dependencies [[`e87777d`](https://github.com/paulocerez/patina/commit/e87777d5e2a8e3feae964e71e796c0fdc3770b79)]:
  - @patina-ui/core@0.4.1
  - @patina-ui/server@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [[`ff974af`](https://github.com/paulocerez/patina/commit/ff974af6e03da79bdb3d80cad2e8837e985216bd)]:
  - @patina-ui/core@0.4.0
  - @patina-ui/server@0.4.0

## 0.3.0

### Minor Changes

- [`79af33d`](https://github.com/paulocerez/patina/commit/79af33dd8be9b8214636e9f1ea83ae53604e6940) Thanks [@paulocerez](https://github.com/paulocerez)! - Follow-ups and integrations.
  
  - **Follow-ups** (`@patina-ui/server/followups`, `patina followups`): turn what customers asked for but couldn't do into issues in Linear, GitHub or Jira (one per request; repeats become comments), a Slack digest, HubSpot notes for account managers, or your own webhook. Prompts are redacted first. `anthropicGrouper` merges requests across wordings and languages and writes the titles.
  - **Shipped notices:** when the issue is completed (`followUpWebhook` for Linear, GitHub and Jira, or `patina followups ship`), the users who asked see a notice on that page: `<ShippedNotice>`, `useSurface().notices`. Needs the new `patina_followups` table: run `migratePostgres` again or add it to your migrations.
  - **Analytics and errors** (`@patina-ui/server/integrations`): `posthogEvents`, `sentryReporter`, `combineEvents` for `onEvent` and `onError`.

### Patch Changes

- Updated dependencies [[`79af33d`](https://github.com/paulocerez/patina/commit/79af33dd8be9b8214636e9f1ea83ae53604e6940)]:
  - @patina-ui/core@0.3.0
  - @patina-ui/server@0.3.0

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
  - @patina-ui/server@0.2.0
