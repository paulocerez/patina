import { euro, useMetrics } from "../data.js";

const METRICS: Record<string, { label: string; format(n: number): string }> = {
  visits: { label: "Completed visits", format: String },
  revenue: { label: "Revenue", format: euro },
  noShows: { label: "No-shows", format: String },
  avgRevenue: { label: "Avg. revenue / visit", format: euro },
};

export function StatCard({ metric }: { metric: string }) {
  const data = useMetrics();
  const def = METRICS[metric];
  if (!def) return null;
  const value = data?.[metric as keyof typeof data];
  return (
    <div className="card stat">
      <div className="stat-label">{def.label}</div>
      <div className="stat-value">{typeof value === "number" ? def.format(value) : "—"}</div>
    </div>
  );
}
