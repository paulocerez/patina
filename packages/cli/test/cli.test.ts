import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAction } from "../src/action.js";
import {
  checkRepo,
  main,
  parseCatalogSource,
  renderBlocks,
  renderCatalog,
  renderMarkdown,
  scanRepo,
  upsertPrComment,
} from "../src/index.js";

const fixture = (name: string) => join(import.meta.dirname, "fixtures", name);
/** A copy outside any git repo (exercises the directory-walk path, and lets tests edit files). */
function copy(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `patina-${name}-`));
  cpSync(fixture(name), dir, { recursive: true });
  return dir;
}
const quiet = () => vi.spyOn(console, "log").mockImplementation(() => {});

afterEach(() => vi.restoreAllMocks());

describe("scan: Next.js + shadcn + Prisma + zod", () => {
  const scan = scanRepo(fixture("shadcn-next"));

  it("detects the stack and design system", () => {
    expect(scan.stack).toMatchObject({ ui: "shadcn", tailwind: true, charts: "recharts" });
    expect(scan.stack.frameworks).toEqual(expect.arrayContaining(["next", "prisma"]));
    expect(scan.design.cssVariables).toMatchObject({
      primary: "222.2 47.4% 11.2%",
      "chart-1": "12 76% 61%",
    });
    expect(scan.design.components.find((c) => c.name === "CardTitle")).toMatchObject({
      importPath: "@/components/ui/card",
    });
    expect(scan.design.components.find((c) => c.name === "TableCell")).toMatchObject({
      importPath: "@/components/ui/table",
    });
  });

  it("finds list endpoints and their row types; skips detail routes", () => {
    expect(Object.keys(scan.sources)).toEqual(["customers", "orders"]);
    expect(scan.sources.orders).toMatchObject({
      endpoint: { path: "/api/orders", method: "GET" },
      params: ["status"],
      fields: {
        id: { kind: "string" },
        createdAt: { kind: "date" },
        total: { kind: "currency" },
        status: { kind: "enum", values: ["PENDING", "PAID", "REFUNDED"] },
        customerId: { kind: "string" },
      },
    });
    expect(scan.sources.orders?.fields).not.toHaveProperty("customer"); // relation
    expect(scan.sources.orders?.fields).not.toHaveProperty("items");
    expect(scan.sources.customers?.fields).toMatchObject({
      email: { kind: "string", sensitive: true },
      plan: { kind: "enum", values: ["free", "pro", "enterprise"] },
      createdAt: { kind: "date" },
      lifetimeSpend: { kind: "currency", optional: true },
    });
  });

  it("drafts a catalog that round-trips and blocks that reuse the app's components", () => {
    const catalog = renderCatalog(scan);
    expect(parseCatalogSource(catalog)).toMatchObject({
      orders: {
        path: "/api/orders",
        fields: { status: { kind: "enum", values: ["PENDING", "PAID", "REFUNDED"] } },
      },
      customers: { fields: { email: { kind: "string", sensitive: true } } },
    });
    const blocks = renderBlocks(scan);
    expect(blocks).toContain(
      'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";',
    );
    expect(blocks).toContain('from "@/components/ui/table"');
    expect(blocks).toContain('from "recharts"');
    expect(blocks).toContain('const COLOR = "hsl(var(--chart-1))";');
    expect(blocks).not.toMatch(/dangerouslySetInnerHTML|https?:\/\//);
  });

  it("is fast", () => {
    const t = performance.now();
    scanRepo(fixture("shadcn-next"));
    expect(performance.now() - t).toBeLessThan(500);
  });
});

describe("scan: Express + MUI + OpenAPI", () => {
  const scan = scanRepo(copy("openapi-mui"));
  it("reads OpenAPI (refs, wrapped lists, query params) and only GET list endpoints", () => {
    expect(scan.stack.ui).toBe("mui");
    expect(Object.keys(scan.sources)).toEqual(["invoices"]);
    expect(scan.sources.invoices).toMatchObject({
      params: ["page", "status"],
      fields: {
        amount: { kind: "currency" },
        status: { kind: "enum", values: ["draft", "sent", "paid"] },
        issuedOn: { kind: "date" },
        customerEmail: { kind: "string", optional: true, sensitive: true },
        overdue: { kind: "bool", optional: true },
      },
    });
    expect(renderBlocks(scan)).toContain('from "@mui/material"');
    expect(renderBlocks(scan)).not.toContain("recharts"); // no chart lib: dependency-free SVG
  });
});

describe("check", () => {
  function setUp() {
    const dir = copy("shadcn-next");
    quiet();
    return main(["scan", "--root", dir]).then(() => dir);
  }

  it("reports nothing right after a scan", async () => {
    const dir = await setUp();
    const r = checkRepo(dir);
    expect(r.counts).toMatchObject({ breaking: 0, changed: 0 });
    expect(renderMarkdown(r)).toContain("No changes that affect");
  });

  it("flags removed fields and enum values as breaking, new fields and endpoints as changes", async () => {
    const dir = await setUp();
    const schema = join(dir, "prisma/schema.prisma");
    writeFileSync(
      schema,
      readFileSync(schema, "utf8")
        .replace("  REFUNDED\n", "")
        .replace("  total     Decimal\n", "  discount  Decimal\n"),
    );
    const zod = join(dir, "src/lib/schemas.ts");
    writeFileSync(
      zod,
      readFileSync(zod, "utf8").replace("  name: z.string(),", "  name: z.number(),"),
    );
    cpSync(join(dir, "src/app/api/customers"), join(dir, "src/app/api/refunds"), {
      recursive: true,
    });

    const r = checkRepo(dir);
    const msgs = r.findings.map((f) => `${f.severity}: ${f.message}`);
    expect(msgs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^breaking: `orders.total` is no longer returned by `\/api\/orders`/),
        expect.stringMatching(/^breaking: `orders.status` lost values `REFUNDED`/),
        expect.stringMatching(
          /^breaking: `customers.name` changed type: catalog says string, the code now says number/,
        ),
        expect.stringMatching(/^changed: `\/api\/orders` now returns `discount` \(number\)/),
        expect.stringMatching(/^changed: New endpoint `\/api\/refunds`/),
        expect.stringMatching(/^changed: `patina\/scan.json` is out of date/),
      ]),
    );
    expect(await main(["check", "--root", dir])).toBe(1);
    expect(await main(["check", "--root", dir, "--fail-on", "never"])).toBe(0);
  });

  it("notices a removed endpoint the catalog relies on", async () => {
    const dir = await setUp();
    writeFileSync(join(dir, "src/app/api/orders/route.ts"), "export const dynamic = 1;\n");
    expect(
      checkRepo(dir).findings.some(
        (f) =>
          f.severity === "breaking" && f.message.includes("`/api/orders` is no longer in the code"),
      ),
    ).toBe(true);
  });
});

describe("GitHub", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  it("creates, updates or skips one sticky comment", async () => {
    const calls: [string, string][] = [];
    const make = (existing: { id: number; body: string }[]) =>
      (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push([init?.method ?? "GET", String(url)]);
        return ok(init?.method ? {} : existing);
      }) as typeof fetch;
    const base = { token: "t", repo: "o/r", pr: 7, body: "x", marker: "<!-- m -->" };
    expect(await upsertPrComment({ ...base, createIfMissing: true, fetch: make([]) })).toBe(
      "created",
    );
    expect(calls.at(-1)).toEqual(["POST", "https://api.github.com/repos/o/r/issues/7/comments"]);
    expect(
      await upsertPrComment({
        ...base,
        createIfMissing: false,
        fetch: make([{ id: 3, body: "old <!-- m -->" }]),
      }),
    ).toBe("updated");
    expect(calls.at(-1)).toEqual(["PATCH", "https://api.github.com/repos/o/r/issues/comments/3"]);
    expect(await upsertPrComment({ ...base, createIfMissing: false, fetch: make([]) })).toBe(
      "skipped",
    );
  });

  it("the action writes a summary, comments on the PR and fails on breaking changes", async () => {
    const dir = await (async () => {
      const d = copy("shadcn-next");
      quiet();
      await main(["scan", "--root", d]);
      writeFileSync(
        join(d, "prisma/schema.prisma"),
        readFileSync(join(d, "prisma/schema.prisma"), "utf8").replace("  total     Decimal\n", ""),
      );
      return d;
    })();
    const summary = join(dir, "summary.md");
    const output = join(dir, "output.txt");
    const event = join(dir, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { number: 12 } }));
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", (async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") posted.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(init?.method ? {} : []), { status: 200 });
    }) as typeof fetch);
    const code = await runAction({
      GITHUB_WORKSPACE: dir,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: output,
      GITHUB_EVENT_PATH: event,
      GITHUB_REPOSITORY: "o/r",
      GITHUB_TOKEN: "t",
    });
    vi.unstubAllGlobals();
    expect(code).toBe(1);
    expect(readFileSync(summary, "utf8")).toContain("❌ **1 breaking**");
    expect(readFileSync(output, "utf8")).toContain("breaking=1");
    expect(JSON.stringify(posted)).toContain("orders.total");
  });
});

describe("init-action", () => {
  it("writes a workflow that uses the action", async () => {
    const dir = copy("openapi-mui");
    quiet();
    expect(await main(["init-action", "--root", dir])).toBe(0);
    const yml = readFileSync(join(dir, ".github/workflows/patina.yml"), "utf8");
    expect(yml).toContain("uses: paulocerez/patina/packages/action@v0");
    expect(yml).toContain("pull-requests: write");
    expect(await main(["init-action", "--root", dir])).toBe(1); // won't overwrite
  });
});

describe("insights", () => {
  it("prints the report from the request log", async () => {
    const { memoryStorage } = await import("@patina-ui/server");
    const storage = memoryStorage();
    const at = new Date().toISOString();
    const base = {
      surfaceId: "orders",
      userId: "u",
      source: "model" as const,
      message: null,
      proposalId: null,
      model: "m",
      latencyMs: 9,
      modelCalls: 1,
    };
    await storage.logRequest({
      ...base,
      id: "1",
      at,
      tenantId: "acme",
      prompt: "Export to Excel",
      outcome: "refused",
      reason: "action",
    });
    await storage.logRequest({
      ...base,
      id: "2",
      at,
      tenantId: "globex",
      prompt: "export to excel!",
      outcome: "refused",
      reason: "action",
    });
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => void out.push(String(s)));
    expect(await main(["insights", "--since", "7d"], { storage })).toBe(0);
    expect(out.join("\n")).toMatch(/\| Export to Excel \| 2 \| 2 \| 2 \| action \|/);
    expect(await main(["insights", "--format", "json"], { storage })).toBe(0);
    expect(JSON.parse(out.at(-1) as string)).toMatchObject({ requests: 2, unmetRate: 1 });
  });

  it("explains what it needs without a database", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const before = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(await main(["insights"])).toBe(1);
    expect(err.mock.calls[0]?.[0]).toMatch(/--database-url/);
    if (before) process.env.DATABASE_URL = before;
  });
});

describe("init-agent", () => {
  it("installs the skill for Claude Code and, optionally, a pointer in AGENTS.md", async () => {
    const dir = copy("openapi-mui");
    quiet();
    expect(await main(["init-agent", "--root", dir, "--agents-md"])).toBe(0);
    const skill = readFileSync(join(dir, ".claude/skills/patina-ui/SKILL.md"), "utf8");
    expect(skill).toMatch(/^---\nname: patina-ui\n/);
    expect(skill).toContain("## Non-negotiable rules");
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("read and follow .claude/skills/patina-ui/SKILL.md");
    expect(await main(["init-agent", "--root", dir, "--agents-md", "--force"])).toBe(0);
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8").match(/## Patina UI/g)).toHaveLength(1); // no duplicates
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await main(["init-agent", "--root", dir])).toBe(1); // won't overwrite without --force
  });
});

describe("scan: Express routers mounted under prefixes", () => {
  it("resolves full paths through imports, nested routers, local routers and require", () => {
    const paths = Object.values(scanRepo(copy("express-mounts")).sources)
      .map((s) => s.endpoint.path)
      .sort();
    expect(paths).toEqual([
      "/api/calls",
      "/api/calls/dashboard-metrics",
      "/health/status",
      "/internal/calls/queue",
      "/old/reports",
      "/v1/calls",
      "/v1/calls/dashboard-metrics",
      "/v1/contacts",
    ]);
    // /:id and /api/accounts/:accountId/…: path parameters are skipped.
  });

  it("still matches row types and params on the full path", () => {
    const calls = Object.values(scanRepo(copy("express-mounts")).sources).find(
      (s) => s.endpoint.path === "/api/calls",
    );
    expect(calls).toMatchObject({
      params: ["status"],
      fields: { id: { kind: "string" }, startedAt: { kind: "date" }, status: { kind: "enum" } },
    });
  });
});
