// @vitest-environment node
/**
 * Keeps skills/patina-ui/SKILL.md (the prompt for coding agents) honest: everything it
 * imports, calls or tells agents to run must exist.
 */
import { readFileSync } from "node:fs";
import * as core from "@patina-ui/core";
import * as server from "@patina-ui/server";
import * as anthropic from "@patina-ui/server/anthropic";
import * as evalMod from "@patina-ui/server/eval";
import * as express from "@patina-ui/server/express";
import * as testing from "@patina-ui/server/testing";
import { expect, it } from "vitest";
import * as react from "../src/index.js";

const root = new URL("../../../", import.meta.url);
const skill = readFileSync(new URL("skills/patina-ui/SKILL.md", root), "utf8");
const modules: Record<string, [Record<string, unknown>, string[]]> = {
  "@patina-ui/core": [core, ["packages/core/src"]],
  "@patina-ui/server": [server, ["packages/server/src"]],
  "@patina-ui/server/anthropic": [anthropic, ["packages/server/src/anthropic.ts"]],
  "@patina-ui/server/eval": [evalMod, ["packages/server/src/eval.ts"]],
  "@patina-ui/server/express": [express, ["packages/server/src/express.ts"]],
  "@patina-ui/server/testing": [testing, ["packages/server/src/testing.ts"]],
  "@patina-ui/react": [react, ["packages/react/src"]],
};

it("has valid skill frontmatter", () => {
  const fm = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/.exec(skill);
  expect(fm?.[1]).toBe("patina-ui");
  expect((fm?.[2] ?? "").length).toBeGreaterThan(50);
  expect((fm?.[2] ?? "").length).toBeLessThan(1024);
});

it("only imports things the packages export", () => {
  const imports = [...skill.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(@patina-ui\/[\w/-]+)"/g)];
  expect(imports.length).toBeGreaterThan(3);
  for (const [, names, spec] of imports) {
    const entry = modules[spec as string];
    expect(entry, `unknown module ${spec}`).toBeDefined();
    const [mod] = entry as [Record<string, unknown>, string[]];
    for (const raw of (names as string).split(",")) {
      const name = raw.replace(/^\s*type\s+/, "").trim();
      if (!name) continue;
      expect(name in mod, `${spec} has no export "${name}"`).toBe(true);
    }
  }
});

it("only calls t.*, f.* and migrations.* helpers that exist", () => {
  for (const [, name] of skill.matchAll(/\bt\.(\w+)\(/g))
    expect(core.t, `t.${name}`).toHaveProperty(name as string);
  for (const [, name] of skill.matchAll(/\bf\.(\w+)\(/g))
    expect(core.f, `f.${name}`).toHaveProperty(name as string);
  for (const [, name] of skill.matchAll(/\bmigrations\.(\w+)\b/g))
    expect(core.migrations, `migrations.${name}`).toHaveProperty(name as string);
});

it("names only real exports and CLI commands in its tables", () => {
  const cliHelp = readFileSync(new URL("packages/cli/src/cli.ts", root), "utf8");
  const commands = [...skill.matchAll(/(?:npx |`)patina ([a-z-]+)/g)].map((m) => m[1] as string);
  expect(commands).toEqual(
    expect.arrayContaining(["scan", "check", "insights", "init-action", "init-agent"]),
  );
  for (const cmd of commands) expect(cliHelp, `patina ${cmd}`).toContain(`patina ${cmd}`);
  const all = { ...core, ...server, ...react, ...anthropic, ...express, ...testing, ...evalMod };
  for (const [, name] of skill.matchAll(/`([A-Z][A-Za-z]+|[a-z][A-Za-z]+)`/g)) {
    // Only check identifiers that look like our API (createX, useX, …), not prose words.
    if (
      /^(create|use|define|migrate|postgres|memory|anthropic|scripted|run|to)[A-Z]/.test(
        name as string,
      ) ||
      /^(Surface|PatinaProvider|PromptInput|ProposalPreview|SurfaceMessage|UndoButton|ResetButton|SkippedNotice|AvailabilityNotice)$/.test(
        name as string,
      )
    )
      expect(all, name).toHaveProperty(name as string);
  }
});
