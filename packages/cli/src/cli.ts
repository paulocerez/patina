import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  getInsights,
  parseSince,
  postgresStorage,
  renderInsightsMarkdown,
  type StorageAdapter,
} from "@patina-ui/server";
import { checkRepo, renderMarkdown, type Severity } from "./check.js";
import { renderBlocks } from "./generate/blocks.js";
import { renderCatalog } from "./generate/catalog.js";
import { scanRepo } from "./scan/index.js";

const HELP = `patina: set up and maintain Patina's data catalog and data blocks

Usage:
  patina scan [--root .] [--out patina] [--force] [--ai] [--model claude-opus-5-5]
      Detect the data your API exposes and your design system. Writes:
        patina/scan.json     snapshot of what was found (commit it; CI compares against it)
        patina/catalog.ts    draft data catalog (catalog.draft.ts if catalog.ts exists)
        patina/blocks.tsx    data blocks in your UI kit (blocks.draft.tsx if it exists)
      --force overwrites catalog.ts / blocks.tsx. --ai asks Claude to refine both drafts
      (needs ANTHROPIC_API_KEY; sends the scan summary and a few named files, never secrets).

  patina check [--root .] [--out patina] [--format markdown|json] [--fail-on breaking|changed|info|never]
      Report API and design changes that affect the catalog (what the GitHub Action runs).

  patina insights [--database-url $DATABASE_URL] [--since 30d] [--until <date>] [--tenant <id>]
                  [--surface <id>] [--format markdown|json]
      What customers asked for, what was applied, and what couldn't be done and why, from the
      request log in your Postgres database (needs the pg package).

  patina init-action [--root .] [--fail-on breaking] [--action paulocerez/patina/packages/action@v0]
      Write .github/workflows/patina.yml so every PR is checked.
`;

function write(file: string, text: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export async function main(
  argv = process.argv.slice(2),
  /** For tests: use this storage instead of connecting to Postgres. */
  deps: { storage?: StorageAdapter } = {},
): Promise<number> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      root: { type: "string", default: "." },
      out: { type: "string", default: "patina" },
      force: { type: "boolean", default: false },
      ai: { type: "boolean", default: false },
      model: { type: "string" },
      format: { type: "string", default: "markdown" },
      "fail-on": { type: "string", default: "breaking" },
      action: { type: "string", default: "paulocerez/patina/packages/action@v0" },
      "database-url": { type: "string" },
      since: { type: "string", default: "30d" },
      until: { type: "string" },
      tenant: { type: "string" },
      surface: { type: "string" },
    },
  });
  const root = resolve(values.root as string);
  const out = values.out as string;

  if (command === "scan") {
    const started = performance.now();
    const scan = scanRepo(root, { outDir: out });
    const ms = Math.round(performance.now() - started);
    let catalogTs = renderCatalog(scan);
    let blocksTsx = renderBlocks(scan);
    if (values.ai) {
      const { enrichWithClaude } = await import("./ai.js");
      try {
        console.log("Asking Claude to refine the drafts…");
        const enriched = await enrichWithClaude(
          root,
          scan,
          { catalogTs, blocksTsx },
          values.model ? { model: values.model } : {},
        );
        catalogTs = enriched.catalogTs;
        blocksTsx = enriched.blocksTsx;
        if (enriched.notes.length)
          console.log(`\nClaude's notes:\n${enriched.notes.map((n) => `  - ${n}`).join("\n")}\n`);
      } catch (e) {
        console.error(
          `--ai failed: ${e instanceof Error ? e.message : String(e)}. Writing the deterministic drafts.`,
        );
      }
    }
    const dir = join(root, out);
    write(join(dir, "scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
    const written: string[] = [`${out}/scan.json`];
    for (const [name, draft, text] of [
      ["catalog.ts", "catalog.draft.ts", catalogTs],
      ["blocks.tsx", "blocks.draft.tsx", blocksTsx],
    ] as const) {
      const target = existsSync(join(dir, name)) && !values.force ? draft : name;
      write(join(dir, target), text);
      written.push(`${out}/${target}`);
    }
    const sources = Object.entries(scan.sources);
    const typed = sources.filter(([, s]) => Object.keys(s.fields).length > 0);
    console.log(`Scanned in ${ms}ms.

  Stack       ${[...scan.stack.frameworks, scan.stack.ui, scan.stack.charts, scan.stack.tables].filter(Boolean).join(", ")}
  Design      ${scan.design.components.length} reusable components, ${Object.keys(scan.design.cssVariables).length} CSS variables, classes: ${scan.design.classes.join(", ") || "none"}
  Data        ${sources.length} GET endpoints, ${typed.length} with a known row type
${typed.map(([id, s]) => `                ${id.padEnd(18)} ${s.endpoint.path} (${Object.keys(s.fields).length} fields)`).join("\n")}

Wrote ${written.join(", ")}.
Next: review the catalog (labels, sensitive fields, params, complete), register the blocks
with dataBlocks(catalog), and commit ${out}/. See docs/guides/data-views.md.`);
    return 0;
  }

  if (command === "check") {
    const report = checkRepo(root, { outDir: out });
    console.log(
      values.format === "json"
        ? JSON.stringify({ counts: report.counts, findings: report.findings }, null, 2)
        : renderMarkdown(report, out),
    );
    const failOn = values["fail-on"] as Severity | "never";
    const failing =
      failOn === "never"
        ? 0
        : failOn === "info"
          ? report.findings.length
          : failOn === "changed"
            ? report.counts.breaking + report.counts.changed
            : report.counts.breaking;
    return failing > 0 ? 1 : 0;
  }

  if (command === "insights") {
    let storage = deps.storage;
    let close = async () => {};
    if (!storage) {
      const url = values["database-url"] ?? process.env.DATABASE_URL;
      if (!url) {
        console.error(
          "Pass --database-url (or set DATABASE_URL) for the database Patina's server writes to.",
        );
        return 1;
      }
      let Pool: typeof import("pg").Pool;
      try {
        const mod = await import("pg");
        Pool = mod.Pool ?? mod.default.Pool;
      } catch {
        console.error("patina insights needs the pg package: npm i -D pg");
        return 1;
      }
      const pool = new Pool({ connectionString: url, max: 1 });
      storage = postgresStorage({ query: (sql, params) => pool.query(sql, params) });
      close = () => pool.end();
    }
    try {
      const report = await getInsights(storage, {
        since: parseSince(values.since as string),
        ...(values.until ? { until: new Date(values.until).toISOString() } : {}),
        ...(values.tenant ? { tenantId: values.tenant } : {}),
        ...(values.surface ? { surfaceId: values.surface } : {}),
      });
      console.log(
        values.format === "json" ? JSON.stringify(report, null, 2) : renderInsightsMarkdown(report),
      );
      return 0;
    } finally {
      await close();
    }
  }

  if (command === "init-action") {
    const file = join(root, ".github/workflows/patina.yml");
    if (existsSync(file) && !values.force) {
      console.error(`${file} already exists (use --force to overwrite).`);
      return 1;
    }
    write(
      file,
      `# Checks every pull request for API and design changes that affect Patina's data catalog.
# Posts (and keeps updating) one comment on the PR. See docs/guides/github-action.md.
name: Patina

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  patina:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ${values.action}
        with:
          fail-on: ${values["fail-on"]}        # breaking | changed | info | never
          # working-directory: .     # where your app lives (monorepos)
          # patina-dir: patina       # where scan.json and catalog.ts are
`,
    );
    console.log(`Wrote ${file}. Commit it, and every PR gets a Patina check.`);
    return 0;
  }

  console.log(HELP);
  return command && command !== "help" && command !== "--help" ? 1 : 0;
}
