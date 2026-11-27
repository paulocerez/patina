import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { scriptedModel } from "@patina-ui/server/testing";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import {
  createPatinaClient,
  PatinaProvider,
  useCollection,
  useSlot,
  useSurface,
  useSurfaceProp,
} from "../src/index.js";

afterEach(cleanup);

const SECTIONS = ["filters", "kpis", "revenue-chart", "appointments"] as const;

/** An existing page that keeps its own JSX and only asks Patina for order and options. */
function Page() {
  const sections = useSlot("clinic.dashboard", "page", "main", SECTIONS);
  const columns = useCollection("clinic.dashboard", "appointments", "columns", [
    "date",
    "vet",
    "revenue",
  ]);
  const range = useSurfaceProp<{ relative: string }>("clinic.dashboard", "filters", "dateRange", {
    relative: "last30Days",
  });
  return (
    <div>
      <p>{`sections: ${sections.join(",")}`}</p>
      <p>{`columns: ${columns.map((c) => c.key).join(",")}`}</p>
      <p>{`range: ${range.relative}`}</p>
    </div>
  );
}

let api: ReturnType<typeof useSurface> | null = null;
function Grab() {
  api = useSurface("clinic.dashboard");
  return null;
}

it("existing pages get the order, visibility and options from three hooks", async () => {
  const handler = createPatinaHandler<{ userId: string; permissions: string[] }>({
    surfaces: [dashboard],
    basePath: "/api",
    storage: memoryStorage(),
    model: scriptedModel(() => ({
      kind: "patch",
      message: "",
      ops: [
        {
          op: "move",
          node: "page",
          prop: "main",
          key: "appointments",
          position: "before",
          anchor: "filters",
        },
        {
          op: "setItem",
          node: "page",
          prop: "main",
          key: "revenue-chart",
          field: "hidden",
          value: true,
        },
        {
          op: "setItem",
          node: "appointments",
          prop: "columns",
          key: "vet",
          field: "hidden",
          value: true,
        },
        { op: "set", node: "filters", prop: "dateRange", value: { relative: "thisWeek" } },
      ],
    })),
    getContext: () => ({ userId: "u", permissions: ["finance.read"] }),
  });
  const client = createPatinaClient({
    endpoint: "/api",
    fetch: (i, init) => handler(new Request(new URL(String(i), "http://t"), init)),
  });
  render(
    <PatinaProvider client={client}>
      <Grab />
      <Page />
    </PatinaProvider>,
  );
  // Before the spec arrives: the page's own defaults.
  expect(screen.getByText("sections: filters,kpis,revenue-chart,appointments")).toBeTruthy();
  await waitFor(() => expect(api?.state).toBeTruthy());
  await act(() => api?.propose("rearrange") as Promise<void>);
  // The preview already shows in the page, then the applied change.
  expect(screen.getByText("sections: appointments,filters,kpis")).toBeTruthy();
  await act(() => api?.commit() as Promise<void>);
  expect(screen.getByText("sections: appointments,filters,kpis")).toBeTruthy();
  expect(screen.getByText("range: thisWeek")).toBeTruthy();
  // Only keys the page knows: the fixture's other columns are dropped.
  expect(screen.getByText("columns: date,revenue")).toBeTruthy();
});

it("without a provider (feature flag off) the hooks return the page's defaults", () => {
  render(<Page />);
  expect(screen.getByText("sections: filters,kpis,revenue-chart,appointments")).toBeTruthy();
  expect(screen.getByText("columns: date,vet,revenue")).toBeTruthy();
  expect(screen.getByText("range: last30Days")).toBeTruthy();
});

it("the client sends params, credentials and the locale on every request", async () => {
  const calls: { url: string; credentials?: RequestCredentials; headers: unknown }[] = [];
  const client = createPatinaClient({
    endpoint: "https://api.example.com/api/patina/",
    locale: "de",
    credentials: "include",
    params: { accountId: "acc-1" },
    fetch: async (i, init) => {
      calls.push({ url: String(i), credentials: init?.credentials, headers: init?.headers });
      return new Response(JSON.stringify({ ok: true }));
    },
  });
  await client.dismissNotice?.("dashboard", "pf-0123456789");
  await client.propose("dashboard", "hide it");
  expect(calls[0]).toEqual({
    url: "https://api.example.com/api/patina/surfaces/dashboard/notices/pf-0123456789/dismiss?accountId=acc-1&locale=de",
    credentials: "include",
    headers: {},
  });
  expect(calls[1]?.headers).toEqual({ "content-type": "application/json" });
});
