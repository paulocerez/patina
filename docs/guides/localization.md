# Localization

Patina speaks the user's language: its own messages, the change previews, the data-view
titles, the model's replies and the UI defaults. It ships **English** and **German** (formal
"Sie"); other locales fall back to English.

## Choosing the language

Per request, the first of these wins:

1. **Your `locale(ctx, request)` hook on the server**, e.g. from the user's profile:

   ```ts
   createPatinaHandler({ locale: (ctx) => ctx.language, … });
   ```
2. **The `x-patina-locale` header.** `<PatinaProvider locale>` sends it on every request:

   ```tsx
   <PatinaProvider endpoint="/api/patina" locale={i18n.language}>
   ```

   Without the prop, the provider uses the browser's language.
3. **`Accept-Language`.**
4. **English.**

`GET /surfaces/:id` returns the locale it used as `locale`.

## Your labels in several languages

Anywhere the manifest or catalog takes a label or name, it accepts a string or one string per
language. That covers node `labels`, component, preset and type `label`s, collection `labels`,
enum `labels`, catalog field `label`s and `valueLabels`.

```ts
defineSurface({
  labels: { table: { en: "Orders table", de: "Bestellungen" } },
  components: {
    OrdersTable: {
      props: {
        columns: t.collection({
          keys: ["date", "total"],
          labels: { date: { en: "Date", de: "Datum" }, total: { en: "Total", de: "Summe" } },
          reorder: true,
          hide: true,
        }),
        pageSize: t.int(
          { min: 10, max: 100 },
          { label: { en: "Rows per page", de: "Zeilen pro Seite" } },
        ),
      },
    },
  },
});
```

With i18next, build them from your existing keys:

```ts
const both = (key: string) => ({ en: i18n.getFixedT("en")(key), de: i18n.getFixedT("de")(key) });
const labels = { table: both("orders.table") };
```

The lookup order is the exact locale, then its base language (`de-AT` → `de`), then English,
then any language given.

## What is and isn't translated

| Translated                                                   | Stays English                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| Refusal and validation messages                              | `description`s (read only by the model)                     |
| Change previews ("„Umsatz“ in Bestellungen ausblenden")      | The model's system prompt, so it is cached once per surface |
| Value names (time ranges, on/off, ascending/descending)      | `patina` CLI output, the insights report, the GitHub Action |
| Data-view titles ("Summe Umsatz nach Tierarzt")              | Developer errors (`defineSurface`, 401 and 404 bodies)      |
| The model's `message` (it's told the reply language)         |                                                             |
| React primitive defaults (Vorschau, Übernehmen, Rückgängig…) |                                                             |

In your own components, `usePatinaText()` returns `{ locale, t }`, so you can use Patina's
texts: `t("loading")`. The data blocks that `patina scan` generates already use it, and pass
the locale to `formatField` for number and currency formatting.

## Adding a language

The catalog is in `packages/core/src/i18n.ts`: one object per locale, and TypeScript makes
sure a new language has every message. Add the locale to `SUPPORTED_LOCALES` and its
`RELATIVE_RANGE_TEXT` entries, and contribute it back.
