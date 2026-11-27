# @patina-ui/react

React bindings for [Patina UI](https://github.com/paulocerez/patina): render a customizable surface from its resolved spec, and build the customization UI from unstyled, headless primitives.

```sh
npm i @patina-ui/react @patina-ui/core
```

```tsx
import {
  PatinaProvider,
  PromptInput,
  ProposalPreview,
  Surface,
  SurfaceMessage,
  UndoButton,
  ResetButton,
} from "@patina-ui/react";

<PatinaProvider endpoint="/api/patina">
  <PromptInput surfaceId="orders" />
  <SurfaceMessage surfaceId="orders" />
  <ProposalPreview surfaceId="orders" />
  <UndoButton surfaceId="orders" />
  <ResetButton surfaceId="orders" />
  <Surface id="orders" components={{ OrdersTable }} />
</PatinaProvider>;
```

Also: `useSurface`, `useQuery` and `formatField` for data blocks, and a `fetchSource` hook into your own data layer. Marked `"use client"` for Next.js. Docs: [React guide](https://github.com/paulocerez/patina/blob/main/docs/guides/react.md).
