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
| `credentials` | `"include"` when the API is on another origin (sends cookies cross-site). Default `"same-origin"`    |
| `params`      | Query parameters on every request, e.g. `{ accountId }` for your `getContext`                        |
| `fetch`       | Custom fetch, e.g. to add an auth header                                                             |
| `client`      | A ready-made `PatinaClient` (used in tests)                                                          |
| `fetchSource` | How [data blocks](data-views.md) load catalog sources. The default is a same-origin GET with cookies |

All `useSurface` calls and primitives for the same surface ID share one store, so they stay in
sync. Pass `locale` (e.g. `i18n.language`) for German or English messages and defaults; it
defaults to the browser's language. See [Localization](localization.md).

## Existing pages: `useSlot`, `useCollection`, `useSurfaceProp`

`<Surface>` draws the page from a map of components. For a page that already exists, it's
usually simpler to keep its JSX and ask Patina only for the order, visibility and options:

```tsx
const SECTIONS = ["metrics", "callChart", "recentCalls"] as const;

function Dashboard() {
  const sections = useSlot("dashboard", "overview", "sections", SECTIONS);
  const cards = useCollection("dashboard", "metrics", "cards", ["calls", "minutes"]);
  const range = useSurfaceProp("dashboard", "overview", "defaultDateRange", "last30days");

  const blocks = {
    metrics: <MetricCards cards={cards.map((c) => c.key)} />, // your existing JSX, as before
    callChart: <CallChart data={data} />,
    recentCalls: <RecentCalls calls={calls} />,
  };
  return (
    <>
      {sections.map((key) => (
        <Fragment key={key}>{blocks[key]}</Fragment>
      ))}
    </>
  );
}
```

- The last argument is your page's default. The hooks return it until the spec has loaded,
  and when there's no `<PatinaProvider>` above, so a feature flag can simply leave the
  provider out.
- Only keys in that default are returned, so the page never renders something it doesn't know.
- Previews show up in place, like with `<Surface>`.

### Adding data views to such a page

`useSlot` only returns your own keys. Once the surface has a [catalog](data-views.md), users
can also insert blocks (tables, charts, numbers). `useSlotItems` returns both, in order, and
`<PatinaBlock>` renders a block with the data context its `useQuery` needs:

```tsx
import { PatinaBlock, useSlotItems } from "@patina-ui/react";
import { PatinaChart, PatinaStat, PatinaTable } from "../patina/blocks"; // from `patina scan`

const DATA_BLOCKS = { PatinaTable, PatinaChart, PatinaStat };

function Dashboard() {
  const items = useSlotItems("dashboard", "overview", "sections", SECTIONS);
  return items.map((item) =>
    item.kind === "host" ? (
      <Fragment key={item.key}>{blocks[item.key]}</Fragment> // your sections, as before
    ) : (
      <PatinaBlock
        key={item.key}
        surfaceId="dashboard"
        nodeId={item.key}
        components={DATA_BLOCKS}
      />
    ),
  );
}
```

- Your own keys still only appear if they're in the default list. Added blocks are told
  apart by their key: Patina gives every inserted node a `u_` key, which base items never
  use. So an unknown key of yours is still dropped.
- A preview shows the new block in place, with live data, before the user applies it.
- Rendering `useQuery` in your own component outside `<Surface>`? Wrap it in
  `<SurfaceScope surfaceId="dashboard">`.

The path: start with `useSlot` (rearrange and hide), then add a catalog on the server and
switch that one call to `useSlotItems` + `<PatinaBlock>`. Nothing else on the page changes.

## Showing what's possible: `useCapabilities`, `<Capabilities>`

Users can't see what the manifest allows. The server sends it with every state, built for
this user (after `restrict` and permissions) and in their language, never by the model:

```ts
const caps = useCapabilities("dashboard");
caps.arrange; // [{ label: "Sections", reorder, hide, items: [{ key, label, hidden }], add: [{ preset, label }] }]
caps.settings; // [{ label: "Default date range", values: [{ value, label: "Last 7 days" }, …] }]
caps.data; // [{ label: "Calls", fields: [{ field, label }], aggregates }] (empty if data views are off)
```

`<Capabilities>` turns it into a "What you can ask for" list, or, with the render prop,
example prompts for chips in the prompt box:

```tsx
<Capabilities surfaceId="dashboard" />  {/* <details> with one line per capability */}

<Capabilities surfaceId="dashboard">
  {({ examples, propose }) =>
    examples.map((e) => <Chip key={e} onClick={() => propose(e)}>{e}</Chip>)}
</Capabilities>
```

Refusals use the same data: when a request asks for data that isn't there (`data_access`,
`not_on_page`), the message ends with what is available, e.g. _"You can add tables, charts
and numbers from Calls (Date, Task, Duration)."_, or the parts of the page that can change.

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
s.notices; // shipped follow-ups for this user; s.dismissNotice(key)
```

## Headless primitives

Every primitive takes `surfaceId`. Each renders minimal unstyled markup with `data-patina`
attributes, or accepts a render-prop child for full control.

| Component                    | Default markup                                                                             | Render prop gets                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `PromptInput`                | `<form><input/><button/></form>`                                                           | `{ value, setValue, submit, busy, formProps, inputProps }`                    |
| `ProposalPreview`            | change list + Apply / Discard (only while previewing)                                      | `{ changes, summary, commit, discard, busy }`                                 |
| `SurfaceMessage`             | `<p role="status">` (or `alert` for errors); answers as a list, clarify options as buttons | `(message, { pick })`: `message` is `{ kind, text, options?, capabilities? }` |
| `UndoButton` / `ResetButton` | `<button>`, disabled when there's nothing to undo or reset, or while a request runs        | (button props pass through)                                                   |
| `RedoButton`                 | `<button>`, only shown after an undo that can be taken back                                | (button props pass through)                                                   |
| `SkippedNotice`              | `<details>` listing changes that no longer apply                                           | `skipped[]`                                                                   |

`message.kind` is `refusal`, `clarify` (with `options`: choices that are each possible; `pick(label)`
sends one as the reply), `answer` (to "what can I …?", with `capabilities` scoped to what was
asked), `error`, or `info` for a reply kind this version doesn't know (it shows the reply's
`message`). After a clarifying question, the next prompt is sent as the reply, together with the
question and the original request.

Undo, redo and reset send the history position the user saw (`expectedSeq`). A second click
sent before the first one's answer is ignored by the store, and a stale one gets a 409 from the
server, after which the current state is shown.

When customizing isn't available to the user, `PromptInput`, `UndoButton`, `RedoButton` and `ResetButton`
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
