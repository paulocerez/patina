/**
 * A dashboard shaped like the first real host's (a vet practice's phone assistant): sections,
 * metric cards, a heatmap, a task chart, a recent-calls table and new bookings, a default date
 * range, and a catalog of calls and appointments. Used by the real-prompt evals
 * (evals/real-de.jsonl).
 *
 * Two contexts:
 * - "before": the host as it was when the prompts were logged: no status or summary column,
 *   no call duration, no emergency flag, and task names unknown (free text).
 * - "after": the host after acting on the insights: those fields exist, `summary` is
 *   display-only, and `restrict` supplies the tenant's task names.
 */
import {
  dataBlocks,
  defineCatalog,
  defineSurface,
  f,
  type Restriction,
  type SurfaceSpec,
  t,
} from "@patina-ui/core";

export const callsCatalog = defineCatalog({
  calls: {
    label: { de: "Anrufe", en: "Calls" },
    endpoint: { path: "/api/calls", method: "GET" },
    params: { range: { from: "overview.defaultDateRange" } },
    complete: true,
    rowKey: "id",
    fields: {
      date: f.date({ label: { de: "Datum", en: "Date" } }),
      contact: f.string({ label: { de: "Kontakt", en: "Contact" } }),
      mainTask: f.string({ label: { de: "Hauptaufgabe", en: "Main task" } }),
      emergency: f.bool({ label: { de: "Notfall", en: "Emergency" } }),
      duration: f.number({ label: { de: "Dauer (Sekunden)", en: "Duration (seconds)" } }),
      durationBucket: f.ranges("duration", [{ value: "short", below: 60 }, { value: "normal" }], {
        label: { de: "Anruflänge", en: "Call length" },
        valueLabels: { short: { de: "Kurz", en: "Short" }, normal: "Normal" },
      }),
      status: f.enum(["answered", "missed", "voicemail"], {
        label: { de: "Status", en: "Status" },
        valueLabels: {
          answered: { de: "Angenommen", en: "Answered" },
          missed: { de: "Verpasst", en: "Missed" },
          voicemail: { de: "Mailbox", en: "Voicemail" },
        },
      }),
      summary: f.string({
        label: { de: "Zusammenfassung", en: "Summary" },
        // Users read it on every call row elsewhere in the app: shown, never sent to the model.
        privacy: "display",
      }),
    },
  },
  appointments: {
    label: { de: "Termine", en: "Appointments" },
    endpoint: { path: "/api/appointments", method: "GET" },
    complete: true,
    rowKey: "id",
    fields: {
      date: f.date({ label: { de: "Datum", en: "Date" } }),
      appointmentType: f.enum(["checkup", "vaccination", "surgery"], {
        label: { de: "Termin", en: "Appointment type" },
        valueLabels: {
          checkup: { de: "Kontrolle", en: "Check-up" },
          vaccination: { de: "Impfung", en: "Vaccination" },
          surgery: { de: "Operation", en: "Surgery" },
        },
      }),
    },
  },
});

const blocks = dataBlocks(callsCatalog);

const base: SurfaceSpec = {
  schemaVersion: 1,
  surfaceId: "calls.dashboard",
  baseVersion: 1,
  root: "overview",
  nodes: {
    overview: {
      component: "Overview",
      props: {
        defaultDateRange: "last7days",
        sections: [
          { key: "metrics" },
          { key: "heatmap" },
          { key: "taskChart" },
          { key: "recentCalls" },
          { key: "newBookings" },
        ],
      },
    },
    metrics: {
      component: "MetricCards",
      props: { cards: [{ key: "callsToday" }, { key: "emergencies" }, { key: "missedCalls" }] },
    },
    heatmap: { component: "Heatmap", props: {} },
    taskChart: { component: "TaskChart", props: { kind: "bar" } },
    recentCalls: {
      component: "RecentCallsTable",
      props: {
        columns: [
          { key: "contact" },
          { key: "task" },
          { key: "date" },
          { key: "status", hidden: true },
          { key: "summary", hidden: true },
        ],
      },
    },
    newBookings: { component: "NewBookings", props: {} },
  },
};

export type CallsCtx = {
  userId: string;
  tenantId: string;
  permissions: string[];
  variant: "before" | "after";
};

export const callsDashboard = defineSurface<CallsCtx>({
  id: "calls.dashboard",
  version: 1,
  base,
  catalog: callsCatalog,
  description: "The start page of a vet practice's phone assistant: calls, tasks and bookings.",
  labels: {
    overview: { de: "Übersicht", en: "Overview" },
    metrics: { de: "Kennzahlen", en: "Metrics" },
    heatmap: { de: "Heatmap", en: "Heatmap" },
    taskChart: { de: "Aufgabenverteilung", en: "Task distribution" },
    recentCalls: { de: "Letzte Anrufe", en: "Recent calls" },
    newBookings: { de: "Neue Buchungen", en: "New bookings" },
  },
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
        sections: t.slot({
          label: { de: "Bereiche", en: "Sections" },
          accepts: [
            "MetricCards",
            "Heatmap",
            "TaskChart",
            "RecentCallsTable",
            "NewBookings",
            ...blocks.componentNames,
          ],
          reorder: true,
          hide: true,
          insert: blocks.presetIds,
        }),
      },
    },
    MetricCards: {
      label: { de: "Kennzahlen", en: "Metrics" },
      props: {
        cards: t.collection({
          keys: ["callsToday", "emergencies", "missedCalls"],
          labels: {
            callsToday: { de: "Anrufe heute", en: "Calls today" },
            emergencies: { de: "Notfälle", en: "Emergencies" },
            missedCalls: { de: "Verpasste Anrufe", en: "Missed calls" },
          },
          reorder: true,
          hide: true,
        }),
      },
    },
    Heatmap: { label: "Heatmap", description: "Calls per weekday and hour.", props: {} },
    TaskChart: {
      label: { de: "Aufgabendiagramm", en: "Task chart" },
      description: "Calls per main task.",
      props: {
        kind: t.enum(["bar", "pie"], {
          label: { de: "Diagrammtyp", en: "Chart type" },
          labels: { bar: { de: "Balken", en: "Bars" }, pie: { de: "Torte", en: "Pie" } },
        }),
      },
    },
    RecentCallsTable: {
      label: { de: "Anruftabelle", en: "Calls table" },
      description: "The latest calls, one per row.",
      props: {
        columns: t.collection({
          label: { de: "Spalten der letzten Anrufe", en: "Recent calls columns" },
          keys: ["contact", "task", "date", "status", "summary"],
          labels: {
            contact: { de: "Kontakt", en: "Contact" },
            task: { de: "Aufgabe", en: "Task" },
            date: { de: "Datum", en: "Date" },
            status: { de: "Status", en: "Status" },
            summary: { de: "Zusammenfassung", en: "Summary" },
          },
          reorder: true,
          hide: true,
        }),
      },
    },
    NewBookings: { label: { de: "Neue Buchungen", en: "New bookings" }, props: {} },
    ...blocks.components,
  },
  presets: { ...blocks.presets },
  restrict: (ctx): Restriction =>
    ctx.variant === "before"
      ? {
          keys: ["status", "summary"],
          fields: ["calls.duration", "calls.durationBucket", "calls.emergency"],
        }
      : { values: { "calls.mainTask": ["Notfall", "Termin", "Rezept", "Sonstiges"] } },
});

export const callsContexts: Record<string, CallsCtx> = {
  before: { userId: "u1", tenantId: "t1", permissions: [], variant: "before" },
  after: { userId: "u1", tenantId: "t1", permissions: [], variant: "after" },
};
