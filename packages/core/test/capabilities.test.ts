import { describe, expect, it } from "vitest";
import {
  capabilities,
  capabilityExamples,
  capabilityHint,
  capabilityLines,
  localizeManifest,
  type Manifest,
  resolve,
  restrictManifest,
  withoutDataViews,
} from "../src/index.js";
import { dataSurface } from "./data-fixtures.js";
import { dashboard } from "./fixtures.js";

/** What the server does per request: localize, restrict, resolve. */
function forUser(
  m: Manifest<unknown>,
  restriction: Parameters<typeof restrictManifest>[1],
  locale = "en",
) {
  const r = restrictManifest(localizeManifest(m, locale), restriction) as Manifest<unknown>;
  return { m: r, spec: resolve(r, []).spec };
}

describe("capabilities", () => {
  it("lists what can be rearranged, set and added, from the restricted manifest", () => {
    const { m, spec } = forUser(dataSurface as Manifest<unknown>, {
      permissions: ["finance.read"],
    });
    const caps = capabilities(m, spec);
    const main = caps.arrange.find((a) => a.node === "page" && a.prop === "main");
    expect(main?.items.map((i) => i.label)).toEqual([
      "Filters",
      "Appointments table",
      "Revenue trend",
    ]);
    expect(main?.add.map((a) => a.label)).toEqual(["Chart", "Number card", "List"]);
    const range = caps.settings.find((s) => s.prop === "dateRange");
    expect(range?.values?.map((v) => v.label)).toEqual(["This week", "This month"]);
    expect(range?.current).toEqual({ relative: "thisMonth" });
    // Query props are data-block internals, not settings.
    expect(caps.settings.some((s) => s.prop === "query")).toBe(false);
    const appointments = caps.data.find((d) => d.source === "appointments");
    expect(appointments?.aggregates).toBe(true);
    expect(appointments?.fields.map((f) => f.field)).toContain("revenue");
  });

  it("never exposes sensitive fields, and respects permissions and restrict", () => {
    const { m, spec } = forUser(dataSurface as Manifest<unknown>, {
      permissions: [],
      nodes: ["trend"],
    });
    const caps = capabilities(m, spec);
    const json = JSON.stringify(caps);
    expect(json).not.toContain("ownerPhone");
    expect(json).not.toContain("Owner phone");
    // revenue needs finance.read: gone from data sources and from the table's columns.
    expect(caps.data.find((d) => d.source === "appointments")?.fields.map((f) => f.field)).toEqual([
      "date",
      "vet",
      "status",
      "owner",
    ]);
    const columns = caps.arrange.find((a) => a.prop === "columns");
    expect(columns?.items.map((i) => i.key)).not.toContain("revenue");
    // A restricted node isn't offered.
    expect(json).not.toContain("Revenue trend");
  });

  it("offers no data when data views are off or nothing can be inserted", () => {
    const { m, spec } = forUser(dataSurface as Manifest<unknown>, { permissions: [] });
    expect(capabilities(withoutDataViews(m), spec, { dataViews: false }).data).toEqual([]);
    const plain = forUser(dashboard as Manifest<unknown>, { permissions: ["finance.read"] });
    expect(capabilities(plain.m, plain.spec).data).toEqual([]);
  });

  it("speaks the user's language", () => {
    const { m, spec } = forUser(dataSurface as Manifest<unknown>, { permissions: [] }, "de");
    const caps = capabilities(m, spec);
    expect(caps.settings.find((s) => s.prop === "dateRange")?.values?.map((v) => v.label)).toEqual([
      "Diese Woche",
      "Dieser Monat",
    ]);
    const lines = capabilityLines(caps, "de");
    expect(lines.some((l) => l.includes("umordnen und ausblenden"))).toBe(true);
    expect(capabilityHint(caps, "de", "data")).toBe(
      "Sie können Tabellen, Diagramme und Kennzahlen aus Appointments (Date, Vet, Status, Owner) und Invoices (Amount, Customer) hinzufügen.",
    );
    expect(capabilityExamples(caps, "de")[0]).toBe("Diagramm: Appointments nach Date");
  });

  it("without data, the hint names the parts of the page instead", () => {
    const plain = forUser(dashboard as Manifest<unknown>, { permissions: ["finance.read"] });
    const hint = capabilityHint(capabilities(plain.m, plain.spec), "en", "data");
    expect(hint.startsWith("Here you can rearrange or hide")).toBe(true);
    expect(capabilityExamples(capabilities(plain.m, plain.spec), "en").length).toBeGreaterThan(1);
  });
});
