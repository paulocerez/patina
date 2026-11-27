---

"@patina-ui/core": minor
"@patina-ui/react": minor
"@patina-ui/server": minor
---

Data views on pages that render themselves, and users can see what they can ask for.

- **Data views with the hooks:** `useSlotItems` returns a slot's own sections plus the blocks users added (`{ kind: "host", key } | { kind: "block", key, node }`), and `<PatinaBlock>` renders a block with the data context `useQuery` needs, so tables, charts and numbers work without `<Surface>`. Previews show new blocks in place; unknown host keys are still dropped. `<SurfaceScope>` gives your own components the same context. `useSlot` is unchanged.
- **What you can ask for:** every `SurfaceState` carries `capabilities` (what can be rearranged, hidden or added, settings with their values, and data sources with their fields), built from the user's restricted manifest and public catalog in their language. Sensitive fields never appear. React: `useCapabilities(surfaceId)` and the headless `<Capabilities>` (a list, or example prompts via its render prop). Core: `capabilities`, `capabilityLines`, `capabilityHint`, `capabilityExamples`.
- **Better refusals:** `data_access` and `not_on_page` refusals end with what is available, from the same data (not written by the model): the data sources and fields when there is a catalog, otherwise the parts of the page that can change.
- **German replies use "Sie":** the model is told to address German-speaking users formally, matching Patina's own German texts.
