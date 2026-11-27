import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { scriptedModel } from "@patina-ui/server/testing";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import {
  createPatinaClient,
  PatinaProvider,
  PromptInput,
  ProposalPreview,
  ResetButton,
  Surface,
  SurfaceMessage,
  UndoButton,
} from "../src/index.js";

afterEach(cleanup);

const model = scriptedModel((_r, prompt) =>
  prompt.includes("delete")
    ? { kind: "refusal", message: "I can only change how this page looks.", ops: [] }
    : {
        kind: "patch",
        message: "ok",
        ops: [
          {
            op: "setItem",
            node: "appointments",
            prop: "columns",
            key: "revenue",
            field: "hidden",
            value: true,
          },
          {
            op: "move",
            node: "appointments",
            prop: "columns",
            key: "status",
            position: "after",
            anchor: "date",
          },
        ],
      },
);

const Table = ({ columns }: { columns: { key: string }[] }) => (
  <table>
    <thead>
      <tr>
        {columns.map((c) => (
          <th key={c.key}>{c.key}</th>
        ))}
      </tr>
    </thead>
  </table>
);
const Page = ({ main }: { main: ReactNode[] }) => <main>{main}</main>;
const Nothing = () => null;
const components = {
  DashboardLayout: Page,
  DataTable: Table,
  FilterBar: Nothing,
  StatRow: Nothing,
  Chart: Nothing,
};

function setup() {
  const handler = createPatinaHandler({
    surfaces: [dashboard],
    storage: memoryStorage(),
    model,
    basePath: "/api/patina",
    getContext: () => ({ userId: "u1", permissions: ["finance.read"] }),
  });
  const client = createPatinaClient({
    endpoint: "/api/patina",
    fetch: (input, init) => handler(new Request(new URL(String(input), "http://test"), init)),
  });
  render(
    <PatinaProvider client={client}>
      <PromptInput surfaceId="clinic.dashboard" />
      <SurfaceMessage surfaceId="clinic.dashboard" />
      <ProposalPreview surfaceId="clinic.dashboard" />
      <UndoButton surfaceId="clinic.dashboard" />
      <ResetButton surfaceId="clinic.dashboard" />
      <Surface id="clinic.dashboard" components={components} fallback={<p>Loading…</p>} />
    </PatinaProvider>,
  );
}

const headers = () => screen.getAllByRole("columnheader").map((th) => th.textContent);

it("prompt → preview in place → apply → undo", async () => {
  setup();
  expect(screen.getByText("Loading…")).toBeTruthy();
  await waitFor(() => expect(headers()).toEqual(["date", "patient", "vet", "status", "revenue"]));
  expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Customize this view"), {
    target: { value: "hide revenue, status after date" },
  });
  await act(async () =>
    fireEvent.submit(
      screen.getByLabelText("Customize this view").closest("form") as HTMLFormElement,
    ),
  );

  // The surface renders the preview, and the preview lists changes generated from the patch.
  await waitFor(() => expect(headers()).toEqual(["date", "status", "patient", "vet"]));
  expect(screen.getByText("Hide “Revenue” in Appointments table")).toBeTruthy();

  await act(async () => fireEvent.click(screen.getByText("Apply")));
  await waitFor(() => expect(screen.queryByText("Apply")).toBeNull());
  expect(headers()).toEqual(["date", "status", "patient", "vet"]);

  await act(async () => fireEvent.click(screen.getByText("Undo")));
  await waitFor(() => expect(headers()).toEqual(["date", "patient", "vet", "status", "revenue"]));
});

it("discarding a preview restores the saved view", async () => {
  setup();
  await waitFor(() => expect(headers()).toHaveLength(5));
  fireEvent.change(screen.getByLabelText("Customize this view"), {
    target: { value: "hide revenue" },
  });
  await act(async () =>
    fireEvent.submit(
      screen.getByLabelText("Customize this view").closest("form") as HTMLFormElement,
    ),
  );
  await waitFor(() => expect(headers()).toHaveLength(4));
  await act(async () => fireEvent.click(screen.getByText("Discard")));
  expect(headers()).toHaveLength(5);
});

it("shows refusals as a status message", async () => {
  setup();
  await waitFor(() => expect(headers()).toHaveLength(5));
  fireEvent.change(screen.getByLabelText("Customize this view"), {
    target: { value: "add a delete button" },
  });
  await act(async () =>
    fireEvent.submit(
      screen.getByLabelText("Customize this view").closest("form") as HTMLFormElement,
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("I can only change how this page looks."),
  );
});
