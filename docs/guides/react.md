# React

`@patina-ui/react` renders surfaces and provides headless building blocks for the customization
UI. It talks only to your server's Patina handler and holds no keys or identity.

```tsx
import { PatinaProvider, Surface, useSurface } from "@patina-ui/react";

<PatinaProvider endpoint="/api/patina">
  <Surface id="orders" components={{ OrdersTable }} fallback={<Spinner />} />
</PatinaProvider>;
```

## `PatinaProvider`

| Prop          |                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `endpoint`    | Where the handler is mounted. Default `"/api/patina"`                                                |
| `fetch`       | Custom fetch, e.g. to add an auth header. The default sends same-origin cookies                      |
| `client`      | A ready-made `PatinaClient` (used in tests)                                                          |
| `fetchSource` | How [data blocks](data-views.md) load catalog sources. The default is a same-origin GET with cookies |

All `useSurface` calls and primitives for the same surface ID share one store, so they stay in
sync.

## `<Surface>`

Renders the resolved spec, or the **preview** while a proposal is pending. Each node becomes
`<YourComponent {...props} nodeId="…" />`:

| Prop type in the manifest | What your component receives                                                   |
| ------------------------- | ------------------------------------------------------------------------------ |
| `t.slot`                  | `ReactNode[]`, ordered, with hidden children removed                           |
| `t.collection`            | `{ key, ...fields }[]`, ordered, with hidden items removed (no `hidden` field) |
| anything else             | the stored value (`25`, `"compact"`, `{ relative: "thisWeek" }`, …)            |

Props the manifest doesn't list are passed through from the base spec unchanged. Values are
only ever passed as props: Patina never injects HTML.

## `useSurface(id)`

```ts
const s = useSurface("orders");
s.status; // "loading" | "idle" | "proposing" | "previewing" | "committing" | "error"
s.spec; // what to render now (preview or saved)
s.state; // last SurfaceState from the server (skipped, canUndo, isCustomized, …)
s.proposal; // { proposalId, changes, summary, previewSpec } while previewing
s.message; // { kind: "refusal" | "clarify" | "error", text } after a request
s.busy, s.canUndo, s.isCustomized;
s.availability; // { customize, dataViews, message? } from the server's availability hook;
s.propose(prompt);
s.commit();
s.discard();
s.undo();
s.reset();
s.reload();
```

## Headless primitives

Every primitive takes `surfaceId`. Each renders minimal unstyled markup with `data-patina`
attributes, or accepts a render-prop child for full control.

| Component                    | Default markup                                             | Render prop gets                                           |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| `PromptInput`                | `<form><input/><button/></form>`                           | `{ value, setValue, submit, busy, formProps, inputProps }` |
| `ProposalPreview`            | change list + Apply / Discard (only while previewing)      | `{ changes, summary, commit, discard, busy }`              |
| `SurfaceMessage`             | `<p role="status">` (or `alert` for errors)                | `{ kind, text }`                                           |
| `UndoButton` / `ResetButton` | `<button>`, disabled when there's nothing to undo or reset | (button props pass through)                                |
| `SkippedNotice`              | `<details>` listing changes that no longer apply           | `skipped[]`                                                |

When customizing isn't available to the user, `PromptInput`, `UndoButton` and `ResetButton`
render nothing. `AvailabilityNotice` shows the host's message (`<p role="note">`, or a render
prop with `{ customize, dataViews, message }`). See [Availability](availability.md).

```tsx
<ProposalPreview surfaceId="orders">
  {({ changes, commit, discard }) => (
    <Callout>
      <ul>
        {changes.map((c) => (
          <li key={c.opIndex}>{c.text}</li>
        ))}
      </ul>
      <Button onClick={commit}>Apply</Button>
      <Button variant="ghost" onClick={discard}>
        Discard
      </Button>
    </Callout>
  )}
</ProposalPreview>;
```

Show `changes` to the user, not `summary`. `changes` is generated from the patch itself, while
`summary` is the model's own text.

## Data blocks: `useQuery` and `formatField`

The blocks that `patina scan` generates read data like this, and your own components can too:

```tsx
import { formatField, type Query, useQuery } from "@patina-ui/react";

export function PatinaStat({ query }: { query?: Query }) {
  const state = useQuery(query); // fetches via fetchSource, evaluates in the browser
  if (state.status !== "ready" || state.result.shape !== "single") return <Skeleton />;
  return (
    <Card title={state.result.label}>{formatField(state.result.valueDef, state.result.value)}</Card>
  );
}
```

`state.status` is one of:

- `loading`;
- `ready`, with `result` as `rows`, `series` or `single`;
- `error`;
- `unavailable` (the source or a field isn't available to this user).

`formatField(def, value)` formats currencies, numbers, enum labels and booleans according to
the catalog.

## Next.js

The bundle starts with `"use client"`. Render `<PatinaProvider>` and `<Surface>` from a client
component. Your server components can still fetch data and pass it down as usual.
