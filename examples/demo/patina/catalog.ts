// Started from `patina scan`, then reviewed: dropped /api/data/metrics (one summary object,
// not rows), bound the params to the page filters, set the currency, and marked revenue as
// finance-only, and made the owner display-only. `patina check` (and the GitHub Action) compares this file with the code.
import { defineCatalog, f } from "@patina-ui/core";

export const catalog = defineCatalog({
  appointments: {
    label: "Appointments",
    description: "Every appointment in the selected date range, one row each.",
    // Found in: server/data.ts#Appointment, server/index.ts
    endpoint: { path: "/api/data/appointments", method: "GET" },
    params: {
      range: { from: "filters.dateRange" },
      status: { from: "filters.status" },
    },
    complete: true, // the endpoint returns all appointments in the range (no pagination)
    rowKey: "id",
    fields: {
      date: f.date({ label: "Date" }),
      time: f.string({ label: "Time" }),
      patient: f.string({ label: "Patient", description: "The pet's name." }),
      species: f.string({ label: "Species" }),
      vet: f.string({ label: "Vet" }),
      // Staff see the owner's name on every appointment already: shown as a column, but never
      // grouped or filtered on, and never sent to the model (privacy: "display").
      owner: f.string({ label: "Owner", privacy: "display" }),
      ownerPhone: f.string({ label: "Owner phone", sensitive: true }),
      status: f.enum(["scheduled", "completed", "cancelled", "noShow"], {
        label: "Status",
        valueLabels: {
          scheduled: "Scheduled",
          completed: "Completed",
          cancelled: "Cancelled",
          noShow: "No-show",
        },
      }),
      revenue: f.currency("EUR", { label: "Revenue", requires: "finance.read" }),
    },
  },
});
