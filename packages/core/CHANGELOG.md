# @patina-ui/core

## 0.2.0

### Minor Changes

- [`9d0bbc9`](https://github.com/paulocerez/patina/commit/9d0bbc9975fe19d4b8e75370052f3c0019ae2aa8) Thanks [@paulocerez](https://github.com/paulocerez)! - German, and a better `patina scan` on Express apps.
  
  - **Localization:** Patina's messages, change previews, value names, data-view titles and UI defaults now come in English and German (formal "Sie"), and the model replies in the user's language. The locale comes from `<PatinaProvider locale>` (default: the browser's language), the server's `locale` hook, or `Accept-Language`. Labels can be given per language: `label: { en: "Orders", de: "Bestellungen" }`. New: `usePatinaText()`, `localizeManifest`, `msg`, `pickLocale`, `tx`.
  - **`patina scan`** follows routers mounted under prefixes (`app.use("/api/calls", callsRouter)`, nested routers, `require`, `module.exports`), and reads one-line TypeScript interfaces. Generated data blocks use `usePatinaText()` for their texts and number formatting.
  - **Default model:** Claude Haiku 5.5 with Sonnet 5.5 as backup (`withBackup`), plus a compact output schema fallback for large surfaces.
  - **Fixes:** reset on an unchanged view no longer writes history; clearer messages.
