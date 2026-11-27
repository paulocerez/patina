import { expect, it } from "vitest";
import {
  defineSurface,
  effectivePatches,
  type HistoryEntry,
  migrations,
  type Patch,
  resolve,
  restrictManifest,
  type SurfaceSpec,
  t,
  undoTarget,
} from "../src/index.js";
import { baseSpec, briefPatch, dashboard } from "./fixtures.js";

const patch = (id: string, ops: Patch["ops"], baseVersion = 1): Patch => ({
  id,
  schemaVersion: 1,
  baseVersion,
  ops,
});
const hide = (key: string) => [
  {
    op: "set" as const,
    node: "appointments",
    path: ["columns", key, "hidden"] as [string, string, string],
    value: true,
  },
];

it("computes effective patches across revert and reset, including undoing a reset", () => {
  const entries: HistoryEntry[] = [
    { kind: "patch", id: "a", seq: 1, patch: patch("a", hide("vet")) },
    { kind: "patch", id: "b", seq: 2, patch: patch("b", hide("status")) },
    { kind: "revert", id: "r1", seq: 3, targetId: "b" },
    { kind: "reset", id: "z", seq: 4 },
  ];
  expect(effectivePatches(entries)).toEqual([]);
  expect(undoTarget(entries)?.id).toBe("z");
  const undone = [...entries, { kind: "revert" as const, id: "r2", seq: 5, targetId: "z" }];
  expect(effectivePatches(undone).map((p) => p.id)).toEqual(["a"]);
  expect(undoTarget(undone)?.id).toBe("a");
});

it("resolves base → tenant → user", () => {
  const r = resolve(dashboard, [
    {
      name: "tenant",
      entries: [
        {
          kind: "patch",
          id: "t",
          seq: 1,
          patch: patch("t", [{ op: "set", node: "appointments", path: ["pageSize"], value: 50 }]),
        },
      ],
    },
    { name: "user", entries: [{ kind: "patch", id: "u", seq: 1, patch: briefPatch }] },
  ]);
  expect(r.skipped).toEqual([]);
  expect(r.patchCount).toBe(2);
  expect(r.spec.nodes.appointments?.props.pageSize).toBe(50);
  expect(r.spec.nodes.filters?.props.dateRange).toEqual({ relative: "thisWeek" });
});

it("applies the restriction before user patches, so restricted things never come back", async () => {
  const m = restrictManifest(dashboard, (await dashboard.restrict?.({ permissions: [] })) ?? {});
  const r = resolve(m, [
    { name: "user", entries: [{ kind: "patch", id: "u", seq: 1, patch: briefPatch }] },
  ]);
  const cols = ((r.spec.nodes.appointments?.props.columns ?? []) as { key: string }[]).map(
    (c) => c.key,
  );
  expect(cols).not.toContain("revenue");
  expect(r.spec.nodes["revenue-chart"]).toBeUndefined();
  // The hide-revenue op and the move anchored on the (now removed) chart are skipped, the filter still applies.
  expect(r.skipped.map((s) => s.code)).toEqual(["unknown_key", "unknown_anchor"]);
  expect(r.spec.nodes.filters?.props.dateRange).toEqual({ relative: "thisWeek" });
});

it("replays old patches through migrations and reports what no longer applies", () => {
  // Version 2 of the base renames the "vet" column to "doctor" and drops "status".
  const v2Spec: SurfaceSpec = structuredClone(baseSpec);
  v2Spec.baseVersion = 2;
  const keys = ["date", "patient", "doctor", "revenue"];
  (v2Spec.nodes.appointments as { props: Record<string, unknown> }).props.columns = keys.map(
    (key) => ({ key }),
  );
  const v2 = defineSurface({
    ...dashboard,
    version: 2,
    base: v2Spec,
    components: {
      ...dashboard.components,
      DataTable: {
        props: {
          columns: t.collection({ keys, reorder: true, hide: true }),
          sort: t.sort(keys),
          rowsPerPage: t.int({ min: 10, max: 100 }),
        },
      },
    },
    migrations: {
      2: [
        migrations.renameKey("appointments", "columns", "vet", "doctor"),
        migrations.renameProp("DataTable", "pageSize", "rowsPerPage"),
      ],
    },
  });
  const old = patch("old", [
    ...hide("vet"),
    ...hide("status"),
    { op: "set", node: "appointments", path: ["pageSize"], value: 50 },
  ]);
  const r = resolve(v2, [
    { name: "user", entries: [{ kind: "patch", id: "old", seq: 1, patch: old }] },
  ]);
  const cols = r.spec.nodes.appointments?.props.columns as { key: string; hidden?: boolean }[];
  expect(cols.find((c) => c.key === "doctor")?.hidden).toBe(true);
  expect(r.spec.nodes.appointments?.props.rowsPerPage).toBe(50);
  expect(r.skipped).toHaveLength(1);
  expect(r.skipped[0]).toMatchObject({ code: "unknown_key", patchId: "old", layer: "user" });
});

it("defineSurface rejects a base spec that does not match the manifest", () => {
  const broken: SurfaceSpec = structuredClone(baseSpec);
  (broken.nodes.appointments as { props: Record<string, unknown> }).props.pageSize = 9999;
  (broken.nodes.page as { props: Record<string, unknown> }).props.main = [{ key: "missing" }];
  expect(() => defineSurface({ ...dashboard, base: broken })).toThrow(
    /references missing node "missing"/,
  );
  expect(() => defineSurface({ ...dashboard, base: broken })).toThrow(
    /prop "pageSize": must be a whole number from 10 to 100/,
  );
});
