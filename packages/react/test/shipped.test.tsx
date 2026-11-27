import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { scriptedModel } from "@patina-ui/server/testing";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import { createPatinaClient, PatinaProvider, ShippedNotice } from "../src/index.js";

afterEach(cleanup);

async function setup(locale: string, message: string | null = null) {
  const storage = memoryStorage();
  const who = { tenantId: null, userId: "u", surfaceId: "clinic.dashboard" };
  await storage.linkFollowUp({ key: "pf-0123456789", title: "No-Show-Quote", requesters: [who] });
  await storage.shipFollowUp("pf-0123456789", message);
  const handler = createPatinaHandler<{ userId: string; permissions: string[] }>({
    surfaces: [dashboard],
    basePath: "/api",
    storage,
    model: scriptedModel(() => ({ kind: "refusal", message: "", ops: [] })),
    getContext: () => ({ userId: "u", permissions: ["finance.read"] }),
  });
  const client = createPatinaClient({
    endpoint: "/api",
    locale,
    fetch: (i, init) => handler(new Request(new URL(String(i), "http://t"), init)),
  });
  render(
    <PatinaProvider client={client} locale={locale}>
      <ShippedNotice surfaceId="clinic.dashboard" />
    </PatinaProvider>,
  );
  return { storage, who };
}

it("shows what the user asked for in their language, and dismissing it sticks", async () => {
  const { storage, who } = await setup("de");
  await waitFor(() =>
    expect(
      screen.getByText("Sie hatten sich „No-Show-Quote“ gewünscht. Das ist jetzt möglich."),
    ).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Ausblenden" }));
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  await waitFor(async () => expect(await storage.listNotices(who)).toEqual([]));
});

it("uses the host's message when there is one", async () => {
  await setup("en", "No-show rate is now under Statistics.");
  await waitFor(() =>
    expect(screen.getByText("No-show rate is now under Statistics.")).toBeTruthy(),
  );
  expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
});
