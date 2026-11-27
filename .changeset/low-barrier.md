---

"@patina-ui/core": minor
"@patina-ui/react": minor
"@patina-ui/server": minor
---

Easier to add to an existing app.

- **CommonJS:** every package also ships a CommonJS build with types, so `require` and TypeScript's `moduleResolution: node` work without loaders or type shims.
- **Existing pages keep their JSX:** `useSlot`, `useCollection` and `useSurfaceProp` return the order, visibility and options for a page that renders itself, with the page's defaults while loading or without a provider.
- **Only the tables you use:** `postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })` needs just `patina_history`; `postgresSchema(features)` and `migratePostgres(query, features)` match. `@patina-ui/server/drizzle` exports the tables for Drizzle, identical to the SQL.
- **No API key, no problem:** `anthropicModel()` no longer needs a key at startup; without one, customizing is off with a short message. `@anthropic-ai/sdk` 0.90+ is supported.
- **Cross-origin APIs:** `<PatinaProvider credentials="include" params={{ accountId }}>`, and the locale is sent as a query parameter, so no CORS change is needed.
