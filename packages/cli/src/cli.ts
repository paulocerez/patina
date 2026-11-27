import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  getInsights,
  parseSince,
  postgresStorage,
  renderInsightsMarkdown,
  type StorageAdapter,
} from "@patina-ui/server";
import {
  type FollowUpGrouper,
  type FollowUpSink,
  linearSink,
  renderFollowUpsText,
  runFollowUps,
  shipFollowUp,
  slackSink,
} from "@patina-ui/server/followups";
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

  patina followups [--database-url $DATABASE_URL] [--since 7d] [--surface <id>] [--dry-run]
                   [--linear-team <team id>] [--linear-label <label id>]… [--linear-state <state id>]
                   [--group] [--language English] [--app-name <name>]
                   [--min-requests 2] [--min-customers 1] [--max 10] [--format text|json]
      Turn what customers asked for but couldn't do into follow-ups: a Linear issue each
      (LINEAR_API_KEY; repeats become comments) and a Slack digest (SLACK_WEBHOOK_URL).
      Run it on a schedule with --since matching the interval. --group asks Claude to merge
      requests that want the same thing (ANTHROPIC_API_KEY); prompts are redacted first.

  patina followups ship <pf-key> [--message <text>] [--database-url $DATABASE_URL]
      Mark a follow-up as shipped: everyone who asked for it sees a notice on that page
      (<ShippedNotice>). Usually done by followUpWebhook when the issue is completed.

  patina init-agent [--root .] [--agents-md] [--force]
      Install the Patina UI skill for coding agents: .claude/skills/patina-ui/SKILL.md
      (Claude Code). --agents-md also adds a pointer to AGENTS.md (Codex, Cursor and others).

  patina init-action [--root .] [--fail-on breaking] [--action paulocerez/patina/packages/action@v0]
      Write .github/workflows/patina.yml so every PR is checked.
`;

/** The agent skill: bundled with the published package, or read from the repo in development. */
export function skillText(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "../../../skills/patina-ui/SKILL.md"), // the canonical copy, in this repo
    join(here, "../skill/SKILL.md"), // bundled with the published package
  ])
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  return null;
}

function write(file: string, text: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** The storage to read the request log from: the test double, or Postgres at --database-url. */
async function openStorage(
  deps: { storage?: StorageAdapter },
  databaseUrl: string | undefined,
): Promise<{ storage: StorageAdapter; close: () => Promise<void> } | null> {
  if (deps.storage) return { storage: deps.storage, close: async () => {} };
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Pass --database-url (or set DATABASE_URL) for the database Patina's server writes to.",
    );
    return null;
  }
  let Pool: typeof import("pg").Pool;
  try {
    const mod = await import("pg");
    Pool = mod.Pool ?? mod.default.Pool;
  } catch {
    console.error("This command needs the pg package: npm i -D pg");
    return null;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  return {
    storage: postgresStorage({ query: (sql, params) => pool.query(sql, params) }),
    close: () => pool.end(),
  };
}

export async function main(
  argv = process.argv.slice(2),
  /** For tests: use this storage instead of connecting to Postgres. */
  deps: { storage?: StorageAdapter; sinks?: FollowUpSink[]; grouper?: FollowUpGrouper } = {},
): Promise<number> {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
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
      "agents-md": { type: "boolean", default: false },
      since: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "linear-team": { type: "string" },
      "linear-label": { type: "string", multiple: true },
      "linear-state": { type: "string" },
      group: { type: "boolean", default: false },
      language: { type: "string" },
      "app-name": { type: "string" },
      "min-requests": { type: "string" },
      "min-customers": { type: "string" },
      max: { type: "string" },
      message: { type: "string" },
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
    const db = await openStorage(deps, values["database-url"]);
    if (!db) return 1;
    const { storage, close } = db;
    try {
      const report = await getInsights(storage, {
        since: parseSince((values.since as string | undefined) ?? "30d"),
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

  if (command === "followups" && positionals[0] === "ship") {
    const key = positionals[1];
    if (!key || !/^pf-[0-9a-f]{10}$/.test(key)) {
      console.error("Usage: patina followups ship <pf-key> [--message <text>]");
      return 1;
    }
    const db = await openStorage(deps, values["database-url"]);
    if (!db) return 1;
    try {
      const n = await shipFollowUp(db.storage, key, values.message ?? null);
      console.log(
        n === 0
          ? `No one is waiting for ${key} (unknown key, or everyone dismissed it).`
          : `Marked ${key} as shipped: ${n} user${n === 1 ? "" : "s"} will see a notice.`,
      );
      return 0;
    } finally {
      await db.close();
    }
  }

  if (command === "followups") {
    const linearKey = process.env.LINEAR_API_KEY;
    const linearTeam = values["linear-team"] ?? process.env.LINEAR_TEAM_ID;
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    const sinks: FollowUpSink[] = [...(deps.sinks ?? [])];
    if (!deps.sinks) {
      if (linearKey && linearTeam)
        sinks.push(
          linearSink({
            apiKey: linearKey,
            teamId: linearTeam,
            ...(values["linear-label"] ? { labelIds: values["linear-label"] as string[] } : {}),
            ...(values["linear-state"] ? { stateId: values["linear-state"] } : {}),
            ...(values["app-name"] ? { appName: values["app-name"] } : {}),
          }),
        );
      else if (linearKey || linearTeam)
        console.error("Linear needs both LINEAR_API_KEY and --linear-team (or LINEAR_TEAM_ID).");
      if (slackUrl)
        sinks.push(
          slackSink({
            webhookUrl: slackUrl,
            ...(values["app-name"] ? { appName: values["app-name"] } : {}),
          }),
        );
    }
    if (sinks.length === 0 && !values["dry-run"]) {
      console.error(
        "No destination: set LINEAR_API_KEY and --linear-team, and/or SLACK_WEBHOOK_URL (or use --dry-run).",
      );
      return 1;
    }
    let grouper = deps.grouper;
    if (!grouper && values.group) {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error("--group asks Claude to merge similar requests and needs ANTHROPIC_API_KEY.");
        return 1;
      }
      const { anthropicGrouper } = await import("@patina-ui/server/anthropic");
      grouper = anthropicGrouper({
        ...(values.model ? { model: values.model } : {}),
        ...(values.language ? { language: values.language } : {}),
      });
    }
    const db = await openStorage(deps, values["database-url"]);
    if (!db) return 1;
    const num = (v: unknown) => (v === undefined ? undefined : Number(v));
    try {
      const run = await runFollowUps({
        storage: db.storage,
        sinks,
        since: parseSince((values.since as string | undefined) ?? "7d"),
        ...(values.until ? { until: new Date(values.until).toISOString() } : {}),
        ...(values.surface ? { surfaceId: values.surface } : {}),
        ...(values["min-requests"] ? { minRequests: num(values["min-requests"]) } : {}),
        ...(values["min-customers"] ? { minCustomers: num(values["min-customers"]) } : {}),
        ...(values.max ? { maxItems: num(values.max) } : {}),
        ...(grouper ? { grouper } : {}),
        dryRun: values["dry-run"] as boolean,
      });
      console.log(
        values.format === "json" ? JSON.stringify(run, null, 2) : renderFollowUpsText(run),
      );
      return run.errors.length ? 1 : 0;
    } finally {
      await db.close();
    }
  }

  if (command === "init-agent") {
    const skill = skillText();
    if (!skill) {
      console.error("Couldn't find the bundled SKILL.md.");
      return 1;
    }
    const file = join(root, ".claude/skills/patina-ui/SKILL.md");
    if (existsSync(file) && !values.force) {
      console.error(`${file} already exists (use --force to update it).`);
      return 1;
    }
    write(file, skill);
    console.log(`Wrote ${file}. Claude Code loads it when you work on Patina UI.`);
    if (values["agents-md"]) {
      const agents = join(root, "AGENTS.md");
      const pointer = `\n## Patina UI\n\nThis app uses Patina UI (@patina-ui/*) for prompt-driven view customization. Before changing\nanything Patina-related (surfaces, manifests, the /api/patina handler, <Surface>, patina/ catalog),\nread and follow .claude/skills/patina-ui/SKILL.md.\n`;
      const current = existsSync(agents) ? readFileSync(agents, "utf8") : "# Agent instructions\n";
      if (current.includes("## Patina UI")) console.log("AGENTS.md already points to the skill.");
      else {
        writeFileSync(agents, `${current.trimEnd()}\n${pointer}`);
        console.log(`Added a Patina UI section to ${agents}.`);
      }
    }
    return 0;
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
