import { defineCatalog, f, publicCatalog, type Query, type SurfaceSpec } from "@patina-ui/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataContext, type FetchSource, SurfaceRenderContext, useQuery } from "../src/data.js";

afterEach(cleanup);

const catalog = publicCatalog(
  defineCatalog({
    calls: {
      label: "Calls",
      endpoint: { path: "/api/calls", method: "GET" },
      complete: true,
      params: { range: { from: "page.dateRange", choices: ["today", "thisWeek"] } },
      fields: { task: f.string() },
    },
  }),
);
const spec = {
  schemaVersion: 1,
  surfaceId: "s",
  baseVersion: 1,
  root: "page",
  nodes: { page: { component: "Page", props: { dateRange: "last30days" } } },
} as SurfaceSpec;

function Stat({ query }: { query: Query }) {
  const q = useQuery(query);
  return (
    <p>
      {q.status === "ready" && q.result.shape === "single"
        ? `${q.result.label}=${q.result.value}`
        : q.status}
    </p>
  );
}

it("a view's own param value overrides the page's, and each value is fetched separately", async () => {
  const fetchSource = vi.fn<FetchSource>(async ({ params }) =>
    params.range === "thisWeek" ? [{ task: "a" }] : [{ task: "a" }, { task: "b" }],
  );
  render(
    <DataContext.Provider value={{ fetchSource, cache: new Map() }}>
      <SurfaceRenderContext.Provider value={{ spec, catalog }}>
        <Stat query={{ source: "calls", metric: { op: "count" } }} />
        <Stat query={{ source: "calls", metric: { op: "count" }, params: { range: "thisWeek" } }} />
      </SurfaceRenderContext.Provider>
    </DataContext.Provider>,
  );
  await waitFor(() => expect(screen.getByText("Number of calls=2")).toBeTruthy());
  expect(screen.getByText("Number of calls (thisWeek)=1")).toBeTruthy();
  expect(fetchSource.mock.calls.map((c) => c[0].params)).toEqual([
    { range: "last30days" },
    { range: "thisWeek" },
  ]);
});
