import { PGlite } from "@electric-sql/pglite";
import { memoryStorage, migratePostgres, postgresStorage } from "../src/index.js";
import { storageContract } from "./storage-contract.js";

storageContract("memoryStorage", async () => memoryStorage());

storageContract("postgresStorage (PGlite)", async () => {
  const db = new PGlite();
  const query = (sql: string, params?: unknown[]) => db.query<Record<string, unknown>>(sql, params);
  await migratePostgres(query);
  return postgresStorage({ query });
});

import type { ProposeResponse, SurfaceState } from "@patina-ui/core";
import { expect, it } from "vitest";
import { dashboard } from "../../core/test/fixtures.js";
import { createPatinaHandler } from "../src/index.js";
import { scriptedModel } from "../src/testing.js";

it("the handler works end to end on Postgres, across handler instances", async () => {
  const db = new PGlite();
  const query = (sql: string, params?: unknown[]) => db.query<Record<string, unknown>>(sql, params);
  await migratePostgres(query);
  const make = () =>
    createPatinaHandler({
      surfaces: [dashboard],
      storage: postgresStorage({ query }),
      model: scriptedModel(() => ({
        kind: "patch",
        message: "ok",
        ops: [
          {
            op: "setItem",
            node: "appointments",
            prop: "columns",
            key: "vet",
            field: "hidden",
            value: true,
          },
        ],
      })),
      getContext: () => ({ userId: "u1", tenantId: "t1", permissions: [] }),
    });
  const call = async (h: ReturnType<typeof make>, method: string, path: string, body?: unknown) =>
    (
      await h(
        new Request(`http://x/surfaces/clinic.dashboard${path}`, {
          method,
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        }),
      )
    ).json();

  const h1 = make();
  const p = (await call(h1, "POST", "/proposals", { prompt: "hide vet" })) as ProposeResponse;
  if (p.kind !== "proposal") throw new Error("expected proposal");
  await call(h1, "POST", `/proposals/${p.proposalId}/commit`);
  const state = (await call(make(), "GET", "")) as SurfaceState;
  const cols = state.spec.nodes.appointments?.props.columns as { key: string; hidden?: boolean }[];
  expect(cols.find((c) => c.key === "vet")?.hidden).toBe(true);
  expect(state.canUndo).toBe(true);
});

it("history only: one table, previews in memory, and the full flow still works", async () => {
  const features = {
    previews: "memory",
    requestLog: false,
    usage: false,
    followUps: false,
  } as const;
  const db = new PGlite();
  const query = (sql: string, params?: unknown[]) => db.query<Record<string, unknown>>(sql, params);
  await migratePostgres(query, features);
  const tables = (
    await query("select tablename from pg_tables where tablename like 'patina_%' order by 1")
  ).rows.map((r) => r.tablename);
  expect(tables).toEqual(["patina_history"]);

  const storage = postgresStorage({ query, ...features });
  for (const m of ["logRequest", "listRequests", "incrementUsage", "linkFollowUp", "listNotices"])
    expect(storage).not.toHaveProperty(m);

  const handler = createPatinaHandler<{ userId: string; permissions: string[] }>({
    surfaces: [dashboard],
    storage,
    basePath: "/api",
    model: scriptedModel(() => ({
      kind: "patch",
      message: "",
      ops: [
        {
          op: "setItem",
          node: "appointments",
          prop: "columns",
          key: "vet",
          field: "hidden",
          value: true,
        },
      ],
    })),
    getContext: () => ({ userId: "u", permissions: ["finance.read"] }),
  });
  const post = (path: string, body?: unknown) =>
    handler(
      new Request(`http://x/api/surfaces/clinic.dashboard${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const proposal = (await (
    await post("/proposals", { prompt: "hide vet" })
  ).json()) as ProposeResponse;
  if (proposal.kind !== "proposal") throw new Error("expected a proposal");
  const committed = (await (
    await post(`/proposals/${proposal.proposalId}/commit`)
  ).json()) as SurfaceState;
  expect(committed.isCustomized).toBe(true);
  expect(await storage.redactPrompts(new Date(Date.now() + 60_000))).toBe(1);
});
