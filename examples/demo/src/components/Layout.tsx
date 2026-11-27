import type { ReactNode } from "react";

/** Patina passes `main` as already ordered, already filtered React nodes. */
export function DashboardLayout({ main }: { main: ReactNode[] }) {
  return <div className="sections">{main}</div>;
}

export function StatRow({ cards }: { cards: ReactNode[] }) {
  return <section className="stat-row">{cards}</section>;
}
