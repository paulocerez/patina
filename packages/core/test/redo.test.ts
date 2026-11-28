import { expect, it } from "vitest";
import {
  effectivePatches,
  type HistoryEntry,
  type Patch,
  redoTarget,
  undoTarget,
} from "../src/index.js";

const p = (id: string, seq: number): HistoryEntry => ({
  kind: "patch",
  id,
  seq,
  patch: { id, schemaVersion: 1, baseVersion: 1, ops: [] } as Patch,
});
const r = (id: string, seq: number, targetId: string): HistoryEntry => ({
  kind: "revert",
  id,
  seq,
  targetId,
});
const ids = (es: HistoryEntry[]) => effectivePatches(es).map((x) => x.id);

it("redo takes back the last undo, and a second redo the one before", () => {
  let h = [p("a", 1), p("b", 2), r("u1", 3, "b"), r("u2", 4, "a")];
  expect(ids(h)).toEqual([]);
  expect(redoTarget(h)?.id).toBe("u2");
  h = [...h, r("x1", 5, "u2")];
  expect(ids(h)).toEqual(["a"]);
  expect(redoTarget(h)?.id).toBe("u1");
  h = [...h, r("x2", 6, "u1")];
  expect(ids(h)).toEqual(["a", "b"]);
  expect(redoTarget(h)).toBeNull();
});

it("a new change ends the redo chain", () => {
  const h = [p("a", 1), r("u1", 2, "a"), p("b", 3)];
  expect(redoTarget(h)).toBeNull();
});

it("an undo after a redo undoes the redone change again", () => {
  const h = [p("a", 1), r("u1", 2, "a"), r("x1", 3, "u1")];
  expect(ids(h)).toEqual(["a"]);
  expect(undoTarget(h)?.id).toBe("a");
  const h2 = [...h, r("u2", 4, "a")];
  expect(ids(h2)).toEqual([]);
  expect(redoTarget(h2)?.id).toBe("u2");
});

it("histories without redo behave as before", () => {
  const h = [p("a", 1), p("b", 2), r("u1", 3, "b")];
  expect(ids(h)).toEqual(["a"]);
  expect(undoTarget(h)?.id).toBe("a");
});
