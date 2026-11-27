import { PGlite } from "@electric-sql/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { expect, it } from "vitest";
import * as tables from "../src/drizzle.js";
import { migratePostgres, type PostgresFeatures } from "../src/postgres.js";

/** Everything about the patina_* tables that drift would show up in. */
async function catalog(pg: PGlite) {
  const q = async (sql: string) => (await pg.query(sql)).rows;
  return {
    columns: await q(`select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_name like 'patina_%' order by 1, 2`),
    constraints: await q(`select c.conrelid::regclass::text as tbl, c.conname, c.contype,
      pg_get_constraintdef(c.oid) as def from pg_constraint c join pg_class t on t.oid = c.conrelid
      where t.relname like 'patina_%' order by 1, 2`),
    indexes: await q(`select tablename, indexname, indexdef from pg_indexes
      where tablename like 'patina_%' order by 1, 2`),
  };
}

async function fromDrizzle(subset: Record<string, unknown>) {
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(subset));
  const pg = new PGlite();
  for (const s of statements) await pg.exec(s);
  return catalog(pg);
}

async function fromSql(features?: PostgresFeatures) {
  const pg = new PGlite();
  await migratePostgres((sql, params) => pg.query(sql, params), features);
  return catalog(pg);
}

it("the Drizzle tables create exactly what Patina's SQL creates", async () => {
  const [a, b] = await Promise.all([fromSql(), fromDrizzle(tables)]);
  expect(b.columns).toEqual(a.columns);
  expect(b.constraints).toEqual(a.constraints);
  expect(b.indexes).toEqual(a.indexes);
  expect(a.columns.length).toBeGreaterThan(40);
}, 60_000);

it("the minimal setup is the history table alone", async () => {
  const [a, b] = await Promise.all([
    fromSql({ previews: "memory", requestLog: false, usage: false, followUps: false }),
    fromDrizzle({ patinaHistory: tables.patinaHistory }),
  ]);
  expect(new Set(a.columns.map((c) => (c as { table_name: string }).table_name))).toEqual(
    new Set(["patina_history"]),
  );
  expect(b).toEqual(a);
}, 60_000);
