import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { scriptedModel } from "@patina-ui/server/testing";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { dataSurface } from "../../core/test/data-fixtures.js";
import {
  createPatinaClient,
  type FetchSource,
  formatField,
  PatinaProvider,
  PromptInput,
  ProposalPreview,
  type Query,
  Surface,
  useQuery,
} from "../src/index.js";

afterEach(cleanup);

const Page = ({ main }: { main: ReactNode[] }) => <main>{main}</main>;
const Nothing = () => null;
function Chart({ query, nodeId }: { query?: Query; nodeId: string }) {
  const q = useQuery(query);
  if (q.status !== "ready" || q.result.shape !== "series") return <p>{`${nodeId}:${q.status}`}</p>;
  return (
    <ul aria-label={nodeId}>
      {q.result.points.map((p) => (
        <li
          key={p.key}
        >{`${p.label}=${formatField(q.result.shape === "series" ? q.result.valueDef : null, p.value, "en-IE")}`}</li>
      ))}
    </ul>
  );
}
const components = { Page, Filters: Nothing, Table: Nothing, Chart, Stat: Nothing, List: Nothing };

const ROWS = [
  { id: 1, date: "2026-11-02", vet: "A", status: "completed", revenue: 100, ownerPhone: "+49 1" },
  { id: 2, date: "2026-11-03", vet: "B", status: "completed", revenue: 50 },
  { id: 3, date: "2026-11-04", vet: "A", status: "completed", revenue: 25 },
];

function setup(permissions: string[]) {
  const model = scriptedModel(() => ({
    kind: "patch",
    message: "",
    ops: [
      {
        op: "insert",
        node: "page",
        prop: "main",
        preset: "block.chart",
        position: "start",
        anchor: "",
        props: {
          kind: "bar",
          query: {
            source: "appointments",
            groupBy: { field: "vet", bucket: null },
            metric: { op: "sum", field: "revenue" },
            where: null,
          },
        },
      },
    ],
  }));
  const handler = createPatinaHandler({
    surfaces: [dataSurface],
    storage: memoryStorage(),
    model,
    basePath: "/api/patina",
    getContext: () => ({ userId: "u1", permissions }),
  });
  const client = createPatinaClient({
    endpoint: "/api/patina",
    fetch: (i, init) => handler(new Request(new URL(String(i), "http://t"), init)),
  });
  const fetchSource = vi.fn<FetchSource>(async () => ROWS);
  render(
    <PatinaProvider client={client} fetchSource={fetchSource}>
      <PromptInput surfaceId="data" />
      <ProposalPreview surfaceId="data" />
      <Surface id="data" components={components} />
    </PatinaProvider>,
  );
  return { fetchSource };
}

it("a prompt adds a chart block that loads the host's endpoint and aggregates in the browser", async () => {
  const { fetchSource } = setup(["finance.read"]);
  await waitFor(() => expect(screen.getByLabelText("trend")).toBeTruthy());
  // The base chart's params come from the spec: filters.dateRange → range=thisMonth.
  expect(fetchSource.mock.calls[0]?.[0]).toMatchObject({
    source: "appointments",
    path: "/api/appointments",
    params: { range: "thisMonth" },
  });

  fireEvent.change(screen.getByLabelText("Customize this view"), {
    target: { value: "revenue by vet" },
  });
  await act(async () =>
    fireEvent.submit(
      screen.getByLabelText("Customize this view").closest("form") as HTMLFormElement,
    ),
  );
  await waitFor(() =>
    expect(screen.getByText("Add Chart: Total revenue by vet to the start")).toBeTruthy(),
  );
  const preview = await screen.findAllByRole("list");
  const block = preview.find((l) => l.getAttribute("aria-label")?.startsWith("u_"));
  expect(block?.textContent).toBe("A=€125B=€50");
  // Deduplicated: one fetch for the same source and params.
  expect(fetchSource).toHaveBeenCalledTimes(1);
});

it("without permission the revenue chart is unavailable and the model can't add one", async () => {
  setup([]);
  await waitFor(() => expect(screen.getByText("trend:unavailable")).toBeTruthy());
});
