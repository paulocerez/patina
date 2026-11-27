---
"@patina-ui/core": minor
"@patina-ui/server": minor
"@patina-ui/react": minor
---

Answer more of what users ask for, without new endpoints.

- **Derived fields:** `f.weekday`, `f.hour`, `f.ranges` and `f.contains` compute a field in the browser from another field of the row ("calls by weekday", "short vs. long", "emergencies"). They are declarative and group, filter and display like enums and yes/no fields, in their natural order.
- **Values per tenant:** `restrict` may be async and return `values: { "source.field": [...] }`. For that request the text field becomes an enum of this tenant's values, so views can filter on it and the model knows the names.
- **Per-view params:** a source param with `choices` lets a single view pick its own value (`query.params`, e.g. a card for "this week" on a page that defaults to 30 days). The model sees the choices, and the view's title names the one picked.
- **Fix:** `anthropicModel`'s `"auto"` schema mode now also falls back to the compact schema on "too many parameters with union types", which large catalogs and dashboards with several data blocks hit.
