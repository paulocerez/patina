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
  UndoButton,
  usePatinaText,
} from "../src/index.js";

afterEach(cleanup);

const Page = ({ main }: { main: ReactNode[] }) => <main>{main}</main>;
const Nothing = () => null;
function Status() {
  const { t, locale } = usePatinaText();
  return <p>{`${locale}: ${t("loading")}`}</p>;
}

it("sends the provider's locale and shows German defaults and previews", async () => {
  const seen: string[] = [];
  const handler = createPatinaHandler<{ userId: string; permissions: string[] }>({
    surfaces: [
      {
        ...dashboard,
        labels: {
          ...dashboard.labels,
          appointments: { en: "Appointments table", de: "Terminliste" },
        },
      },
    ],
    storage: memoryStorage(),
    model: scriptedModel(() => ({
      kind: "patch",
      message: "",
      ops: [
        {
          op: "setItem",
          node: "appointments",
          prop: "columns",
          key: "revenue",
          field: "hidden",
          value: true,
        },
      ],
    })),
    basePath: "/api",
    getContext: (req) => {
      seen.push(new URL(req.url).searchParams.get("locale") ?? "");
      return { userId: "u", permissions: ["finance.read"] };
    },
  });
  // The client is built by the provider (with the locale), so pass only fetch.
  const fetchImpl = ((i: string | URL | Request, init?: RequestInit) =>
    handler(new Request(new URL(String(i), "http://t"), init))) as typeof fetch;
  render(
    <PatinaProvider endpoint="/api" fetch={fetchImpl} locale="de-DE">
      <Status />
      <PromptInput surfaceId="clinic.dashboard" />
      <ProposalPreview surfaceId="clinic.dashboard" />
      <UndoButton surfaceId="clinic.dashboard" />
      <ResetButton surfaceId="clinic.dashboard" />
      <Surface
        id="clinic.dashboard"
        components={{
          DashboardLayout: Page,
          DataTable: Nothing,
          FilterBar: Nothing,
          StatRow: Nothing,
          Chart: Nothing,
        }}
      />
    </PatinaProvider>,
  );
  expect(screen.getByText("de-DE: Wird geladen…")).toBeTruthy();
  const input = await screen.findByLabelText("Diese Ansicht anpassen");
  expect(screen.getByText("Rückgängig")).toBeTruthy();
  expect(screen.getByText("Auf Standard zurücksetzen")).toBeTruthy();
  fireEvent.change(input, { target: { value: "Umsatz ausblenden" } });
  await act(async () => fireEvent.submit(input.closest("form") as HTMLFormElement));
  await waitFor(() => expect(screen.getByText("„Revenue“ in Terminliste ausblenden")).toBeTruthy());
  expect(screen.getByText("Übernehmen")).toBeTruthy();
  expect(seen.every((l) => l === "de-DE")).toBe(true);
  void createPatinaClient;
});
