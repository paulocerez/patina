import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { scriptedModel } from "@patina-ui/server/testing";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import {
  AvailabilityNotice,
  createPatinaClient,
  PatinaProvider,
  PromptInput,
  ResetButton,
  Surface,
  UndoButton,
} from "../src/index.js";

afterEach(cleanup);

const Page = ({ main }: { main: ReactNode[] }) => <main>{main}</main>;
const Table = ({ columns }: { columns: { key: string }[] }) => (
  <p>{`columns: ${columns.map((c) => c.key).join(",")}`}</p>
);
const Nothing = () => null;

function setup(customize: boolean) {
  const handler = createPatinaHandler<{ userId: string; permissions: string[] }>({
    surfaces: [dashboard],
    basePath: "/api",
    storage: memoryStorage(),
    model: scriptedModel(() => ({ kind: "refusal", message: "", ops: [] })),
    getContext: () => ({ userId: "u", permissions: ["finance.read"] }),
    availability: () => ({ customize, message: "Upgrade to Pro to customize this dashboard." }),
  });
  const client = createPatinaClient({
    endpoint: "/api",
    fetch: (i, init) => handler(new Request(new URL(String(i), "http://t"), init)),
  });
  render(
    <PatinaProvider client={client}>
      <AvailabilityNotice surfaceId="clinic.dashboard" />
      <PromptInput surfaceId="clinic.dashboard" />
      <UndoButton surfaceId="clinic.dashboard" />
      <ResetButton surfaceId="clinic.dashboard" />
      <Surface
        id="clinic.dashboard"
        components={{
          DashboardLayout: Page,
          DataTable: Table,
          FilterBar: Nothing,
          StatRow: Nothing,
          Chart: Nothing,
        }}
      />
    </PatinaProvider>,
  );
}

it("when customizing is off, the view still renders and the controls disappear", async () => {
  setup(false);
  await waitFor(() => expect(screen.getByText(/^columns:/)).toBeTruthy());
  expect(screen.queryByLabelText("Customize this view")).toBeNull();
  expect(screen.queryByText("Undo")).toBeNull();
  expect(screen.queryByText("Reset to default")).toBeNull();
  expect(screen.getByRole("note").textContent).toBe("Upgrade to Pro to customize this dashboard.");
});

it("when it's on, the controls are there and no notice is shown", async () => {
  setup(true);
  await waitFor(() => expect(screen.getByText(/^columns:/)).toBeTruthy());
  expect(screen.getByLabelText("Customize this view")).toBeTruthy();
  expect(screen.queryByRole("note")).toBeNull();
});
