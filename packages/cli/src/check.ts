import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCatalogSource } from "./catalog-parse.js";
import { scanRepo } from "./scan/index.js";
import type { ScannedSource, ScanResult } from "./scan/types.js";

export type Severity = "breaking" | "changed" | "info";

export interface Finding {
  severity: Severity;
  message: string;
}

export interface CheckReport {
  findings: Finding[];
  counts: Record<Severity, number>;
  scan: ScanResult;
}

const COMPATIBLE: Record<string, string[]> = {
  number: ["number", "currency"],
  currency: ["number", "currency"],
  date: ["date", "string"],
  string: ["string", "date", "enum"],
  enum: ["enum"],
  bool: ["bool"],
};

const code = (s: string) => `\`${s}\``;

/**
 * Compares the repo as it is now with what Patina was set up against: the committed
 * `patina/scan.json` snapshot and the hand-reviewed `patina/catalog.ts`.
 *
 * - breaking: something the catalog relies on is gone or changed type, so saved data views
 *   using it will stop showing data.
 * - changed: the API or design system changed in a way the catalog/blocks may want to follow.
 * - info: things worth knowing (new fields not offered yet, …).
 */
export function checkRepo(root: string, options: { outDir?: string } = {}): CheckReport {
  const outDir = options.outDir ?? "patina";
  const scan = scanRepo(root, { outDir });
  const findings: Finding[] = [];
  const add = (severity: Severity, message: string) => findings.push({ severity, message });

  const snapshotFile = join(root, outDir, "scan.json");
  let prev: ScanResult | null = null;
  if (existsSync(snapshotFile)) {
    try {
      prev = JSON.parse(readFileSync(snapshotFile, "utf8")) as ScanResult;
    } catch {
      add(
        "changed",
        `${code(`${outDir}/scan.json`)} is not valid JSON. Run ${code("patina scan")} to regenerate it.`,
      );
    }
  } else {
    add(
      "info",
      `No ${code(`${outDir}/scan.json`)} yet. Run ${code("npx patina scan")} and commit the result to start tracking changes.`,
    );
  }

  const byPath = new Map<string, [string, ScannedSource]>(
    Object.entries(scan.sources).map(([id, s]) => [s.endpoint.path, [id, s]]),
  );
  const prevPaths = new Set(Object.values(prev?.sources ?? {}).map((s) => s.endpoint.path));

  // 1. The catalog against the code.
  const catalogFile = join(root, outDir, "catalog.ts");
  const catalogPaths = new Set<string>();
  if (existsSync(catalogFile)) {
    const catalog = parseCatalogSource(readFileSync(catalogFile, "utf8"));
    if (!catalog)
      add(
        "changed",
        `Couldn't read ${code(`${outDir}/catalog.ts`)} (no ${code("defineCatalog({…})")} found).`,
      );
    for (const [id, cs] of Object.entries(catalog ?? {})) {
      if (!cs.path) continue;
      catalogPaths.add(cs.path);
      const found = byPath.get(cs.path);
      if (!found) {
        if (prevPaths.has(cs.path))
          add(
            "breaking",
            `Source ${code(id)}: endpoint ${code(cs.path)} is no longer in the code (removed or renamed?). Views built on it will show nothing.`,
          );
        else
          add(
            "info",
            `Source ${code(id)}: couldn't find endpoint ${code(cs.path)} in the code to verify it.`,
          );
        continue;
      }
      const [, scanned] = found;
      if (Object.keys(scanned.fields).length === 0) {
        add(
          "info",
          `Source ${code(id)}: couldn't determine the row type of ${code(cs.path)} to verify its fields.`,
        );
        continue;
      }
      for (const [name, f] of Object.entries(cs.fields)) {
        const now = scanned.fields[name];
        if (!now) {
          add(
            "breaking",
            `${code(`${id}.${name}`)} is no longer returned by ${code(cs.path)} (${scanned.evidence.join(", ")}). Remove it from the catalog or restore it in the API.`,
          );
          continue;
        }
        if (f.kind !== "unknown" && !(COMPATIBLE[f.kind] ?? [f.kind]).includes(now.kind))
          add(
            "breaking",
            `${code(`${id}.${name}`)} changed type: catalog says ${f.kind}, the code now says ${now.kind}.`,
          );
        if (f.kind === "enum" && now.kind === "enum") {
          const gone = (f.values ?? []).filter((v) => !(now.values ?? []).includes(v));
          const added = (now.values ?? []).filter((v) => !(f.values ?? []).includes(v));
          if (gone.length)
            add(
              "breaking",
              `${code(`${id}.${name}`)} lost values ${gone.map(code).join(", ")}. Filters on them will match nothing.`,
            );
          if (added.length)
            add(
              "changed",
              `${code(`${id}.${name}`)} has new values ${added.map(code).join(", ")} not in the catalog.`,
            );
        }
        if (now.sensitive && !f.sensitive)
          add(
            "info",
            `${code(`${id}.${name}`)} looks personal. Consider ${code("sensitive: true")} so it's never offered to the model.`,
          );
      }
      // Fields left out of the catalog on purpose stay quiet: only report ones that are new
      // since the last snapshot.
      const before = Object.values(prev?.sources ?? {}).find(
        (p) => p.endpoint.path === cs.path,
      )?.fields;
      const fresh = Object.entries(scanned.fields).filter(
        ([name]) => !(name in cs.fields) && !(before && name in before),
      );
      for (const [name, f] of fresh)
        add(
          f.sensitive || !before ? "info" : "changed",
          `${code(cs.path)} now returns ${code(name)} (${f.kind}), which the catalog doesn't offer${f.sensitive ? " (looks personal: keep it out, or add it with sensitive: true)" : ""}.`,
        );
    }
  }

  // 2. The code against the last snapshot.
  if (prev) {
    for (const [id, s] of Object.entries(scan.sources))
      if (!prevPaths.has(s.endpoint.path) && !catalogPaths.has(s.endpoint.path))
        add(
          "changed",
          `New endpoint ${code(s.endpoint.path)}${Object.keys(s.fields).length ? ` (${Object.keys(s.fields).length} fields)` : ""}. Add it to the catalog as ${code(id)} if users should build views from it.`,
        );
    for (const s of Object.values(prev.sources))
      if (!byPath.has(s.endpoint.path) && !catalogPaths.has(s.endpoint.path))
        add("info", `Endpoint ${code(s.endpoint.path)} is gone (it wasn't in the catalog).`);
    if (prev.stack.ui !== scan.stack.ui)
      add(
        "changed",
        `UI kit changed (${prev.stack.ui} → ${scan.stack.ui}). Regenerate the data blocks with ${code("patina scan")} and compare with ${code(`${outDir}/blocks.draft.tsx`)}.`,
      );
    if (prev.stack.charts !== scan.stack.charts)
      add(
        "info",
        `Chart library changed (${prev.stack.charts ?? "none"} → ${scan.stack.charts ?? "none"}).`,
      );
    const prevComps = new Set(prev.design.components.map((c) => `${c.name}@${c.importPath}`));
    const nowComps = new Set(scan.design.components.map((c) => `${c.name}@${c.importPath}`));
    const compsGone = [...prevComps].filter((c) => !nowComps.has(c));
    if (compsGone.length)
      add(
        "changed",
        `Components the data blocks may use moved or disappeared: ${compsGone.map(code).join(", ")}.`,
      );
    const varsChanged = Object.keys({
      ...prev.design.cssVariables,
      ...scan.design.cssVariables,
    }).filter((k) => prev?.design.cssVariables[k] !== scan.design.cssVariables[k]);
    if (varsChanged.length)
      add(
        "info",
        `${varsChanged.length} design token(s) changed (${varsChanged
          .slice(0, 5)
          .map((v) => code(`--${v}`))
          .join(", ")}${varsChanged.length > 5 ? ", …" : ""}).`,
      );
    if (JSON.stringify(prev) !== JSON.stringify(scan))
      add(
        "changed",
        `${code(`${outDir}/scan.json`)} is out of date. Run ${code("npx patina scan")} and commit it.`,
      );
  }

  const counts = { breaking: 0, changed: 0, info: 0 } as Record<Severity, number>;
  for (const f of findings) counts[f.severity]++;
  return { findings, counts, scan };
}

export const COMMENT_MARKER = "<!-- patina-check -->";

export function renderMarkdown(report: CheckReport, outDir = "patina"): string {
  const { counts, findings } = report;
  const lines = [COMMENT_MARKER, "### Patina: data & design check", ""];
  if (counts.breaking + counts.changed === 0) {
    lines.push("✅ No changes that affect Patina's data catalog or data blocks.");
  } else {
    lines.push(
      `${counts.breaking ? `❌ **${counts.breaking} breaking**` : "✅ 0 breaking"} · ⚠️ ${counts.changed} to review · ℹ️ ${counts.info} notes`,
    );
  }
  const section = (sev: Severity, title: string, note: string) => {
    const items = findings.filter((f) => f.severity === sev);
    if (!items.length) return;
    lines.push("", `**${title}**: ${note}`, "", ...items.map((f) => `- ${f.message}`));
  };
  section("breaking", "Breaking", "saved data views that use these will stop showing data");
  section("changed", "To review", "the API or design system changed");
  const info = findings.filter((f) => f.severity === "info");
  if (info.length)
    lines.push(
      "",
      `<details><summary>${info.length} note(s)</summary>`,
      "",
      ...info.map((f) => `- ${f.message}`),
      "",
      "</details>",
    );
  if (counts.breaking + counts.changed > 0)
    lines.push(
      "",
      `<sub>Fix: run \`npx patina scan\`, compare \`${outDir}/catalog.draft.ts\` with \`${outDir}/catalog.ts\`, update the catalog, and commit \`${outDir}/scan.json\`.</sub>`,
    );
  return `${lines.join("\n")}\n`;
}
