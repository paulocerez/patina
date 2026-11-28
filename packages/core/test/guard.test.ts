import { describe, expect, it } from "vitest";
import {
  defineSurface,
  isCapabilityQuestion,
  localizeManifest,
  type Manifest,
  mentions,
  relevantOptions,
  rescueRefusal,
  type SurfaceSpec,
  t,
} from "../src/index.js";

describe("mentions", () => {
  it("matches German inflections and compounds", () => {
    expect(mentions("bei den letzten Anrufen", "Letzte Anrufe")).toBe(true);
    expect(mentions("Standard-Zeitraum auf heute setzen", "Heute")).toBe(true);
    expect(mentions("den Anrufstatus sehen", "Status")).toBe(true);
    expect(mentions("Kurzzusammenfassung des Anrufs", "Zusammenfassung")).toBe(true);
    expect(mentions("Größe ändern", "Groesse")).toBe(true);
  });
  it("doesn't match inside unrelated words or out of order", () => {
    expect(mentions("Heutelage", "Tag")).toBe(false);
    expect(mentions("Anrufe letzte", "Letzte Anrufe")).toBe(false);
    expect(mentions("letzte 30 Tage", "Letzte 7 Tage")).toBe(false);
  });
});

describe("isCapabilityQuestion", () => {
  it.each([
    "Was kann ich noch anzeigen lassen bei den letzten Anrufen?",
    "Welche Spalten gibt es?",
    "What else can I show here?",
    "Which columns can I add?",
  ])("asks what is possible: %s", (p) => expect(isCapabilityQuestion(p)).toBe(true));
  it.each([
    "Kann ich die Heatmap entfernen?",
    "Zeige, welche Anrufe es gibt",
    "Standard-Zeitraum auf Heute setzen",
    "Show what was booked today",
  ])("is a request: %s", (p) => expect(isCapabilityQuestion(p)).toBe(false));
});

const base: SurfaceSpec = {
  schemaVersion: 1,
  surfaceId: "g",
  baseVersion: 1,
  root: "overview",
  nodes: {
    overview: {
      component: "Overview",
      props: { defaultDateRange: "last7days", main: [{ key: "calls" }] },
    },
    calls: {
      component: "Table",
      props: { columns: [{ key: "contact" }, { key: "status", hidden: true }] },
    },
  },
};
const surface = defineSurface({
  id: "g",
  version: 1,
  base,
  labels: { calls: { de: "Letzte Anrufe", en: "Recent calls" } },
  components: {
    Overview: {
      props: {
        defaultDateRange: t.enum(["today", "last7days", "last30days"], {
          label: { de: "Standard-Zeitraum", en: "Default date range" },
          labels: {
            today: { de: "Heute", en: "Today" },
            last7days: { de: "Letzte 7 Tage", en: "Last 7 days" },
            last30days: { de: "Letzte 30 Tage", en: "Last 30 days" },
          },
        }),
        main: t.slot({ accepts: ["Table"], reorder: true, hide: true, insert: [] }),
      },
    },
    Table: {
      props: {
        columns: t.collection({
          keys: ["contact", "status"],
          labels: { contact: "Kontakt", status: "Status" },
          reorder: true,
          hide: true,
        }),
      },
    },
  },
});
const de = localizeManifest(surface, "de") as Manifest<unknown>;

describe("rescueRefusal", () => {
  it('proposes an allowed value the model refused ("Heute")', () => {
    const r = rescueRefusal(de, base, "Standard-Zeitraum auf Heute setzen", {
      category: "other",
      message:
        "Der Standard-Zeitraum kann nur auf Letzte 7 Tage oder Letzte 30 Tage gesetzt werden.",
    });
    expect(r).toMatchObject({
      kind: "patch",
      ops: [{ op: "set", node: "overview", path: ["defaultDateRange"], value: "today" }],
    });
  });

  it("works in English too, and when only the refusal names the setting", () => {
    const en = localizeManifest(surface, "en") as Manifest<unknown>;
    expect(
      rescueRefusal(en, base, "make it today", {
        category: "missing_value",
        message: "The default date range can only be the last 7 or 30 days.",
      }),
    ).toMatchObject({ kind: "patch", ops: [{ value: "today" }] });
  });

  it("doesn't propose the current value", () => {
    expect(
      rescueRefusal(de, base, "Standard-Zeitraum auf Letzte 7 Tage", { category: "other" }),
    ).toBeNull();
  });

  it("asks which one when several values are named", () => {
    const r = rescueRefusal(de, base, "Standard-Zeitraum: Heute oder Letzte 30 Tage", {
      category: "unclear",
    });
    expect(r?.kind).toBe("clarify");
    expect(r?.kind === "clarify" && r.options.map((o) => o.label)).toEqual([
      "Standard-Zeitraum: Heute",
      "Standard-Zeitraum: Letzte 30 Tage",
    ]);
  });

  it("shows a hidden column the model said doesn't exist", () => {
    expect(
      rescueRefusal(de, base, "den Anrufstatus in den letzten Anrufen", {
        category: "missing_field",
        detail: { node: "calls", wanted: "status" },
      }),
    ).toMatchObject({
      kind: "patch",
      ops: [{ op: "set", node: "calls", path: ["columns", "status", "hidden"], value: false }],
    });
  });

  it("never overrides safety, data access or action refusals", () => {
    for (const category of ["safety", "data_access", "action"])
      expect(rescueRefusal(de, base, "Standard-Zeitraum auf Heute", { category })).toBeNull();
  });

  it("leaves refusals of things that don't exist alone", () => {
    expect(
      rescueRefusal(de, base, "Letzte Anrufe: 10 Zeilen anzeigen", {
        category: "missing_setting",
        detail: { node: "calls", wanted: "rowLimit" },
      }),
    ).toBeNull();
  });
});

it("relevantOptions lists allowed values with labels in the user's language", () => {
  const text = relevantOptions(de, base, "Standard-Zeitraum auf Heute setzen", {
    category: "other",
  });
  expect(text).toContain('today = "Heute"');
  expect(text).toContain('last30days = "Letzte 30 Tage"');
});
