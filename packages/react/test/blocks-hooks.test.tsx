import type { Query } from "@patina-ui/core";
import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { scriptedModel } from "@patina-ui/server/testing";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Fragment } from "react";
import { afterEach, expect, it } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import {
  Capabilities,
  createPatinaClient,
  PatinaBlock,
  PatinaProvider,
  useQuery,
  useSlotItems,
  useSurface,
} from "../src/index.js";

afterEach(cleanup);

/** The host's data block (normally generated into patina/blocks.tsx by `patina scan`). */
function Stat({ query }: { query: Query }) {
  const q = useQuery(query);
  return <p>{q.status === "ready" ? `stat: ${JSON.stringify(q.result)}` : `stat ${q.status}`}</p>;
}
const BLOCKS = { Stat };

// The page knows "filters" and "table". "trend" exists in the base spec but the page doesn't
// render it, so it must never show up.
const SECTIONS = ["filters", "table"] as const;
function Page() {
  const items = useSlotItems("data", "page", "main", SECTIONS);
  const own = { filters: <p>own: filters</p>, table: <p>own: table</p> };
  return (
    <div>
      <p>{`order: ${items.map((i) => (i.kind === "host" ? i.key : `block:${i.node.component}`)).join(",")}`}</p>
      {items.map((item) =>
        item.kind === "host" ? (
          <Fragment key={item.key}>{own[item.key]}</Fragment>
        ) : (
          <PatinaBlock key={item.key} surfaceId="data" nodeId={item.key} components={BLOCKS} />
        ),
      )}
    </div>
  );
}

let api: ReturnType<typeof useSurface> | null = null;
function Grab() {
  api = useSurface("data");
  return null;
}

function setup() {
  const handler = createPatinaHandler<{ userId: string; permissions: string[] }>({
    surfaces: [dataSurface],
    basePath: "/api",
    storage: memoryStorage(),
    model: scriptedModel(() => ({
      kind: "patch",
      message: "",
      ops: [
        {
          op: "insert",
          node: "page",
          prop: "main",
          preset: "block.stat",
          position: "before",
          anchor: "table",
        },
      ],
    })),
    getContext: () => ({ userId: "u", permissions: [] }),
  });
  const client = createPatinaClient({
    endpoint: "/api",
    fetch: (i, init) => handler(new Request(new URL(String(i), "http://t"), init)),
  });
  const fetched: string[] = [];
  render(
    <PatinaProvider
      client={client}
      locale="en"
      fetchSource={async ({ path }) => {
        fetched.push(path);
        return [{ status: "completed" }, { status: "noShow" }, { status: "noShow" }];
      }}
    >
      <Grab />
      <Capabilities surfaceId="data">
        {({ examples, lines, propose }) => (
          <div>
            <p>{`lines: ${lines.length}`}</p>
            {examples.map((e) => (
              <button key={e} type="button" onClick={() => void propose(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </Capabilities>
      <Page />
    </PatinaProvider>,
  );
  return { fetched };
}

it("an inserted data block renders through the hooks path, in place, with its data", async () => {
  const { fetched } = setup();
  await waitFor(() => expect(api?.state).toBeTruthy());
  expect(screen.getByText("order: filters,table")).toBeTruthy();

  // The preview already shows the new block in place, with live data.
  await act(() => api?.propose("add a card with the number of appointments") as Promise<void>);
  expect(screen.getByText("order: filters,block:Stat,table")).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/^stat: /)).toBeTruthy());
  expect(fetched).toContain("/api/appointments");

  await act(() => api?.commit() as Promise<void>);
  expect(screen.getByText("order: filters,block:Stat,table")).toBeTruthy();
  // "trend" (a base key the page doesn't know) never reaches the page: the order above is exact.
  expect(screen.queryByText(/order: .*trend/)).toBeNull();
});

it("<Capabilities> offers example prompts that send a request", async () => {
  setup();
  await waitFor(() => expect(screen.getByText(/^lines: [1-9]/)).toBeTruthy());
  const chip = screen.getAllByRole("button")[0] as HTMLElement;
  await act(async () => {
    fireEvent.click(chip);
  });
  await waitFor(() => expect(api?.proposal).toBeTruthy());
});
