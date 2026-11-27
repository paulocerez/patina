import { useEffect } from "react";
import { useFilters } from "../data.js";

const RANGES: Record<string, string> = {
  today: "Today",
  thisWeek: "This week",
  lastWeek: "Last week",
  thisMonth: "This month",
  last30Days: "Last 30 days",
  last90Days: "Last 90 days",
};
const STATUSES: Record<string, string> = {
  all: "All statuses",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  noShow: "No-show",
};

/** `dateRange` and `status` are the customizable *defaults*; the user can still change filters live. */
export function FilterBar({
  dateRange = { relative: "last30Days" },
  status = "all",
}: {
  dateRange?: { relative: string };
  status?: string;
}) {
  const { filters, setFilters } = useFilters();
  // When the saved defaults change (a committed customization), apply them.
  useEffect(
    () => setFilters({ range: dateRange.relative, status }),
    [dateRange.relative, status, setFilters],
  );
  return (
    <section className="filter-bar">
      <label>
        Date range
        <select
          value={filters.range}
          onChange={(e) => setFilters({ ...filters, range: e.target.value })}
        >
          {Object.entries(RANGES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
              {v === dateRange.relative ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          {Object.entries(STATUSES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
              {v === status ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
