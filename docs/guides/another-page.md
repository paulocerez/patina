# Customizing another page

A surface is one page. Once the first is live, adding a second reuses almost everything: the
handler, `getContext`, storage, the provider and your customizer UI stay as they are. A second
page is usually one surface file, a few lines in that page and a line in the handler.

## Checklist

**Server**

- [ ] **One new surface file**, e.g. `patina/surfaces/calls.ts`, next to the first one. Give
      it its own `id` (`"calls"`) and `version: 1`, and a base spec that reproduces the page
      exactly as it looks today.
- [ ] **Open only what the page already does.** Sections as a slot (`reorder`, `hide`), lists
      or columns as collections, and settings the page already has as `t.enum` with the
      page's own values. Leave everything else out; you can open more later.
- [ ] **Labels per language** for every section, column and setting, from your existing
      i18n keys (`{ en, de }`).
- [ ] **Add it to the handler:** `surfaces: [dashboard, calls]`. Nothing else changes:
      `getContext`, storage, the model and `availability` cover every surface (`availability`
      gets the `surfaceId`, if a page needs its own flag).
- [ ] **Data views:** if the page should offer them, give the surface the catalog (or a
      subset of its sources) and add `dataBlocks(catalog)` to it. The catalog is shared; the
      blocks in `patina/blocks.tsx` are too.
- [ ] **No new tables.** Customizations of every surface share `patina_history`.

**Client**

- [ ] **The page keeps its JSX.** Wrap the part that changes with the hooks:
      `useSlot` (or `useSlotItems` with data views), `useCollection`, `useSurfaceProp`, each
      with the page's current values as defaults.
- [ ] **Reuse the customizer** with the new `surfaceId`. If it shows `<Capabilities>`, the
      new page gets its own list of what users can ask for automatically.
- [ ] **The provider** is usually already at the app root. If not, the same
      `<PatinaProvider>` props as on the first page.

**Check**

- [ ] The page looks exactly as before, for users with and without the flag.
- [ ] One rearrange, one setting, and (with data) one new view: preview, apply, reload,
      undo, reset.
- [ ] A user without a permission doesn't see restricted columns or data in the page, in
      the capability list or in refusals.
- [ ] The request log (`patina insights --surface calls`) shows what users ask for on the
      new page. Keep it on while the page is new.

## Why one surface per page

Each surface has its own base spec, version and history, so pages evolve independently: you
can bump the dashboard's `version` and migrate its customizations without touching calls. A
user's change on one page can never affect another, and the model only sees the page the
user is on, which keeps prompts small and answers accurate.

Parts shared across pages (a header, a filter bar) are better left out of surfaces, or
modelled per page if users should be able to change them separately.
