import { expect, describe as group, it } from "vitest";
import {
  buildModelRequest,
  defineCatalog,
  describe,
  describeQuery,
  f,
  localizeManifest,
  type MessageKey,
  msg,
  pickLocale,
  tx,
  validate,
} from "../src/index.js";
import { baseSpec, briefPatch, dashboard } from "./fixtures.js";

group("locales", () => {
  it("picks the best supported locale from a preference or Accept-Language header", () => {
    expect(pickLocale("de")).toBe("de");
    expect(pickLocale("de-AT")).toBe("de");
    expect(pickLocale("fr-FR,fr;q=0.9,de;q=0.8,en;q=0.5")).toBe("de");
    expect(pickLocale("en-US,en;q=0.9")).toBe("en");
    expect(pickLocale("fr")).toBe("en");
    expect(pickLocale(undefined)).toBe("en");
  });

  it("resolves host texts per language with sensible fallbacks", () => {
    expect(tx("Calls", "de")).toBe("Calls");
    expect(tx({ en: "Calls", de: "Anrufe" }, "de-AT")).toBe("Anrufe");
    expect(tx({ en: "Calls", de: "Anrufe" }, "fr")).toBe("Calls");
    expect(tx({ de: "Anrufe" }, "en")).toBe("Anrufe");
  });

  it("has every message in German, formal (Sie), and different from English where it should be", () => {
    const keys = [
      "unknownNode",
      "cantAdd",
      "customizeOff",
      "promptLabel",
      "apply",
      "hide",
    ] as MessageKey[];
    for (const k of keys)
      expect(msg("de", k, { id: "x", preset: "X", item: "Y", inName: "" })).not.toBe(
        msg("en", k, { id: "x", preset: "X", item: "Y", inName: "" }),
      );
    const german = (
      [
        "typeSomething",
        "promptTooLong",
        "rateLimited",
        "quotaUser",
        "customizeOff",
        "promptPlaceholder",
        "skippedMany",
      ] as MessageKey[]
    )
      .map((k) => msg("de", k, { max: 5, count: 2 }))
      .join(" ");
    expect(german).not.toMatch(/\b(du|dein\w*|dich|dir)\b/i);
    expect(german).toMatch(/\bSie\b|\bIhr\w*\b/);
  });
});

group("German surface", () => {
  // Host labels given per language, as a German-first app would.
  const de = localizeManifest(
    {
      ...dashboard,
      labels: {
        ...dashboard.labels,
        appointments: { en: "Appointments table", de: "Terminliste" },
        filters: { en: "Filters", de: "Filter" },
        page: { en: "Page", de: "Seite" },
        "revenue-chart": { en: "Revenue chart", de: "Umsatzdiagramm" },
      },
      presets: {
        "stat.noShows": {
          ...dashboard.presets["stat.noShows"],
          label: { en: "No-shows card", de: "Nichterscheinen-Karte" },
        } as never,
      },
    },
    "de",
  );

  it("previews changes in German", () => {
    expect(describe(de, baseSpec, briefPatch).map((c) => c.text)).toEqual([
      "„Revenue“ in Terminliste ausblenden",
      "Terminliste vor Umsatzdiagramm verschieben",
      "Date range in Filter auf Diese Woche setzen",
    ]);
  });

  it("explains refusals in German", () => {
    const [issue] = validate(de, baseSpec, [
      { op: "insert", node: "kpis", prop: "cards", preset: "deleteButton", key: "u_x", to: "end" },
    ]);
    expect(issue?.message).toBe(
      "„Delete button“ kann hier nicht hinzugefügt werden. Möglich ist: Nichterscheinen-Karte.",
    );
    const [range] = validate(de, baseSpec, [
      { op: "set", node: "appointments", path: ["pageSize"], value: 5000 },
    ]);
    expect(range?.message).toBe("Rows per page muss eine ganze Zahl von 10 bis 100 sein.");
  });

  it("asks the model to reply in German and shows it German names", () => {
    const req = buildModelRequest(de, baseSpec, "Umsatzspalte ausblenden");
    expect(req.user).toContain(
      '<reply_language>German (formal: address the user as "Sie")</reply_language>',
    );
    expect(req.user).toContain('"name": "Terminliste"');
    // The system prompt stays the same for every user (cacheable): English.
    expect(req.system).toBe(buildModelRequest(localizeManifest(de, "en"), baseSpec, "x").system);
  });

  it("titles data views in German, keeping German noun capitals", () => {
    const catalog = defineCatalog({
      appointments: {
        label: { en: "Appointments", de: "Termine" },
        endpoint: { path: "/api/a", method: "GET" },
        complete: true,
        fields: {
          vet: f.string({ label: { en: "Vet", de: "Tierarzt" } }),
          revenue: f.currency("EUR", { label: { en: "Revenue", de: "Umsatz" } }),
          status: f.enum(["noShow"], {
            label: "Status",
            valueLabels: { noShow: { en: "No-show", de: "Nicht erschienen" } },
          }),
        },
      },
    });
    const q = {
      source: "appointments",
      groupBy: { field: "vet" },
      metric: { op: "sum" as const, field: "revenue" },
    };
    expect(describeQuery(catalog, q, "en")).toBe("Total revenue by vet");
    expect(describeQuery(catalog, q, "de")).toBe("Summe Umsatz nach Tierarzt");
    expect(
      describeQuery(
        catalog,
        {
          source: "appointments",
          metric: { op: "count" },
          where: [{ field: "status", value: "noShow" }],
        },
        "de",
      ),
    ).toBe("Anzahl Termine (Status: Nicht erschienen)");
  });
});
