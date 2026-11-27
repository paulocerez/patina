/**
 * Optional `--ai` enrichment: Claude turns the deterministic drafts into a reviewed-looking
 * catalog (labels, descriptions, sensitivity, TODOs resolved) and adapts blocks.tsx to the
 * app's conventions. Sends only the scan summary, the two drafts and a few named files —
 * never secrets or .env files. Output is written as files for the developer to review.
 */
import { isSecretPath, Repo } from "./scan/files.js";
import type { ScanResult } from "./scan/types.js";

const MAX_FILES = 8;
const MAX_CHARS = 12_000;

export interface Enriched {
  catalogTs: string;
  blocksTsx: string;
  notes: string[];
}

/** The files Claude gets to see, beyond the scan summary. */
export function contextFiles(root: string, scan: ScanResult): { file: string; text: string }[] {
  const repo = new Repo(root);
  const picks: string[] = [];
  const add = (f: string | undefined) => {
    if (f && !picks.includes(f) && !isSecretPath(f) && picks.length < MAX_FILES) picks.push(f);
  };
  for (const c of scan.design.components) add(c.file);
  // One existing page/screen that uses those components, to copy its conventions.
  const importers = repo.files.filter(
    (f) =>
      /\.(tsx|jsx)$/.test(f) &&
      !f.includes("components/ui/") &&
      scan.design.components.some((c) => (repo.read(f) ?? "").includes(c.importPath)),
  );
  add(importers.find((f) => /(page|route|screen|view|dashboard)/i.test(f)) ?? importers[0]);
  for (const s of Object.values(scan.sources))
    for (const ev of s.evidence) add(ev.split(/[#:]/)[0]);
  return picks
    .map((file) => ({ file, text: (repo.read(file) ?? "").slice(0, MAX_CHARS) }))
    .filter((f) => f.text);
}

const SYSTEM = `You help set up Patina, a library that lets users of a web app compose views of data the app already exposes.
You receive a deterministic scan of the repository, two drafts (catalog.ts and blocks.tsx) and a few files from the app.
Return improved versions of both files.

catalog.ts rules:
- Keep the exact format: import { defineCatalog, f } from "@patina-ui/core"; export const catalog = defineCatalog({ ... }).
- Only include endpoints present in the scan. Never invent endpoints, fields or URLs. Only GET.
- Write short human labels and one-sentence descriptions. Use the app's own words where you can see them.
- Mark anything personal or confidential as sensitive: true (contact details, health data, credentials, financial identifiers).
- Set currency codes when the app makes them clear; otherwise leave the TODO.
- Bind params to page state only when an existing node and prop obviously match; otherwise keep the TODO comment.
- Leave complete: false unless the code clearly returns all rows (no pagination).

blocks.tsx rules:
- Keep the three exports and their props exactly: PatinaTable({ query }), PatinaChart({ kind, query }), PatinaStat({ query }).
- Keep using useQuery and formatField from "@patina-ui/react". No data fetching of your own, no business logic.
- Use only components, classes and CSS variables that exist in the files you were shown; match their markup conventions.
- No dangerouslySetInnerHTML, no external URLs.

notes: short bullet points for the developer about what to double-check.`;

export async function enrichWithClaude(
  root: string,
  scan: ScanResult,
  drafts: { catalogTs: string; blocksTsx: string },
  options: { model?: string } = {},
): Promise<Enriched> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const files = contextFiles(root, scan);
  const user = [
    "<scan>",
    JSON.stringify(scan, null, 1),
    "</scan>",
    '<draft path="patina/catalog.ts">',
    drafts.catalogTs,
    "</draft>",
    '<draft path="patina/blocks.tsx">',
    drafts.blocksTsx,
    "</draft>",
    ...files.flatMap((f) => [`<file path=${JSON.stringify(f.file)}>`, f.text, "</file>"]),
  ].join("\n");
  const model = options.model ?? "claude-opus-5-5";
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32_000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            catalogTs: { type: "string" },
            blocksTsx: { type: "string" },
            notes: { type: "array", items: { type: "string" } },
          },
          required: ["catalogTs", "blocksTsx", "notes"],
          additionalProperties: false,
        },
      },
    },
    ...(model.includes("haiku")
      ? {}
      : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (message.stop_reason === "max_tokens")
    throw new Error("Claude's answer was cut off; try again.");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = JSON.parse(text) as Enriched;
  if (
    !parsed.catalogTs.includes("defineCatalog(") ||
    !/export function PatinaStat/.test(parsed.blocksTsx)
  )
    throw new Error(
      "Claude's answer didn't keep the required structure; keeping the deterministic drafts.",
    );
  if (/dangerouslySetInnerHTML|https?:\/\//.test(parsed.blocksTsx))
    throw new Error(
      "Claude's blocks.tsx contained raw HTML or an external URL; keeping the deterministic draft.",
    );
  return parsed;
}
