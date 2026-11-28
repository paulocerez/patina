import type { ProposeResponse, SurfaceState } from "@patina-ui/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import {
  type PatinaClient,
  PatinaProvider,
  PatinaRequestError,
  PromptInput,
  RedoButton,
  SurfaceMessage,
  UndoButton,
} from "../src/index.js";

afterEach(cleanup);

const state = (over: Partial<SurfaceState> = {}): SurfaceState => ({
  surfaceId: dashboard.id,
  spec: dashboard.base,
  skipped: [],
  canUndo: true,
  canRedo: false,
  seq: 3,
  isCustomized: true,
  render: { slots: {}, collections: {} },
  availability: { customize: true, dataViews: true },
  ...over,
});

function fakeClient(over: Partial<PatinaClient> = {}): PatinaClient {
  return {
    get: vi.fn(async () => state()),
    propose: vi.fn(async () => ({ kind: "refusal", message: "no" }) as ProposeResponse),
    commit: vi.fn(async () => state()),
    undo: vi.fn(async () => state({ seq: 4, canRedo: true })),
    redo: vi.fn(async () => state({ seq: 5 })),
    reset: vi.fn(async () => state()),
    ...over,
  };
}

const ui = (client: PatinaClient) =>
  render(
    <PatinaProvider endpoint="/x" client={client}>
      <PromptInput surfaceId={dashboard.id} />
      <SurfaceMessage surfaceId={dashboard.id} />
      <UndoButton surfaceId={dashboard.id} />
      <RedoButton surfaceId={dashboard.id} />
    </PatinaProvider>,
  );

it("a double click on Undo sends one request, with the seq the user saw", async () => {
  let release: (s: SurfaceState) => void = () => {};
  const client = fakeClient({
    undo: vi.fn(() => new Promise<SurfaceState>((r) => (release = r))),
  });
  ui(client);
  const undo = await screen.findByText("Undo");
  await waitFor(() => expect((undo as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(undo);
  fireEvent.click(undo);
  await act(async () => release(state({ seq: 4, canRedo: true })));
  expect(client.undo).toHaveBeenCalledTimes(1);
  expect(client.undo).toHaveBeenCalledWith(dashboard.id, 3);
  // …and Redo appears, to take it back.
  fireEvent.click(await screen.findByText("Redo"));
  await waitFor(() => expect(client.redo).toHaveBeenCalledWith(dashboard.id, 4));
});

it("a stale undo (409) shows the current state instead of failing", async () => {
  const client = fakeClient({
    undo: vi.fn(async () => {
      throw new PatinaRequestError(409, "Your view changed in the meantime.");
    }),
  });
  ui(client);
  const undo = await screen.findByText("Undo");
  await waitFor(() => expect((undo as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(undo);
  await screen.findByText("Your view changed in the meantime.");
  expect(client.get).toHaveBeenCalledTimes(2);
});

it("clarify options are buttons; picking one replies with the question as thread", async () => {
  const propose = vi
    .fn()
    .mockResolvedValueOnce({
      kind: "clarify",
      question: "By task or by status?",
      options: [{ label: "By task" }, { label: "By status" }],
    })
    .mockResolvedValueOnce({ kind: "refusal", message: "ok" });
  const client = fakeClient({ propose });
  ui(client);
  fireEvent.change(await screen.findByRole("textbox"), { target: { value: "emergency chart" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form") as HTMLFormElement);
  fireEvent.click(await screen.findByText("By task"));
  await waitFor(() => expect(propose).toHaveBeenCalledTimes(2));
  expect(propose).toHaveBeenLastCalledWith(dashboard.id, "By task", {
    prompt: "emergency chart",
    question: "By task or by status?",
  });
});

it("shows answers as a list, and the message of reply kinds it doesn't know", async () => {
  const propose = vi
    .fn()
    .mockResolvedValueOnce({
      kind: "answer",
      message: "In Recent calls you can:\n- Columns (Contact, Status): reorder, hide",
      question: "In Recent calls you can:\n- Columns (Contact, Status): reorder, hide",
      capabilities: { arrange: [], settings: [], data: [] },
    })
    .mockResolvedValueOnce({ kind: "somethingNew", message: "A future reply." });
  ui(fakeClient({ propose }));
  const box = await screen.findByRole("textbox");
  fireEvent.change(box, { target: { value: "what can I show?" } });
  fireEvent.submit(box.closest("form") as HTMLFormElement);
  expect(await screen.findByText("Columns (Contact, Status): reorder, hide")).toBeTruthy();
  fireEvent.change(box, { target: { value: "x" } });
  fireEvent.submit(box.closest("form") as HTMLFormElement);
  expect(await screen.findByText("A future reply.")).toBeTruthy();
});
