import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { euro, useMetrics } from "../data.js";

export function Chart({
  kind = "line",
  groupBy = "week",
}: {
  kind?: "line" | "bar";
  groupBy?: string;
}) {
  const data = useMetrics(groupBy);
  const series = data?.series ?? [];
  const axes = (
    <>
      <CartesianGrid stroke="#e7e5e4" vertical={false} />
      <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis
        tickFormatter={euro}
        tick={{ fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        width={70}
      />
      <Tooltip formatter={(v) => euro(Number(v))} />
    </>
  );
  return (
    <section className="card">
      <h2>Revenue by {groupBy}</h2>
      <div style={{ height: 220 }}>
        <ResponsiveContainer>
          {kind === "bar" ? (
            <BarChart data={series}>
              {axes}
              <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={series}>
              {axes}
              <Line dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
