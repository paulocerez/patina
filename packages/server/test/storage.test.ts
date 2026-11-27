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

import type { ProposeResponse, SurfaceState } from "@patina/core";
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
