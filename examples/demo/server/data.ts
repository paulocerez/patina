/**
 * Fake clinic data. This stands in for the host's real data layer, and shows where
 * permissions are enforced: here, in the host's API, not in Patina.
 */
import type { DemoContext } from "./users.js";

export interface Appointment {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  patient: string;
  species: string;
  vet: string;
  owner: string;
  ownerPhone: string;
  status: "scheduled" | "completed" | "cancelled" | "noShow";
  revenue?: number;
}

const PETS = [
  ["Bella", "Dog"],
  ["Milo", "Cat"],
  ["Luna", "Cat"],
  ["Charlie", "Dog"],
  ["Coco", "Rabbit"],
  ["Max", "Dog"],
  ["Nala", "Cat"],
  ["Rocky", "Dog"],
  ["Pip", "Guinea pig"],
  ["Simba", "Cat"],
  ["Daisy", "Dog"],
  ["Kiwi", "Parrot"],
] as const;
const VETS = ["Dr. Okafor", "Dr. Lindqvist", "Dr. Moreau"];
const OWNERS = ["M. Schmidt", "A. Rossi", "J. Kowalski", "S. Dubois", "L. García", "K. Novak"];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function generate(): Appointment[] {
  const rand = rng(42);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: Appointment[] = [];
  for (let dayOffset = -100; dayOffset <= 7; dayOffset++) {
    const day = new Date(today.getTime() + dayOffset * 86_400_000);
    if (day.getUTCDay() === 0) continue;
    const count = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const [patient, species] = PETS[Math.floor(rand() * PETS.length)] as readonly [
        string,
        string,
      ];
      const future = dayOffset > 0;
      const r = rand();
      const status: Appointment["status"] = future
        ? "scheduled"
        : r < 0.08
          ? "noShow"
          : r < 0.15
            ? "cancelled"
            : dayOffset === 0 && r > 0.6
              ? "scheduled"
              : "completed";
      out.push({
        id: `${iso(day)}-${i}`,
        date: iso(day),
        time: `${String(8 + Math.floor(rand() * 9)).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`,
        patient,
        species,
        vet: VETS[Math.floor(rand() * VETS.length)] as string,
        owner: OWNERS[(patient.length + i) % OWNERS.length] as string,
        ownerPhone: `+49 30 ${String(1000000 + Math.floor(rand() * 8999999))}`,
        status,
        revenue: status === "completed" ? Math.round(40 + rand() * 260) : 0,
      });
    }
  }
  return out;
}

const ALL = generate();

export function rangeBounds(range: string): [string, string] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const add = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
  const weekStart = add(today, -((today.getUTCDay() + 6) % 7));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  switch (range) {
    case "today":
      return [iso(today), iso(today)];
    case "thisWeek":
      return [iso(weekStart), iso(add(weekStart, 6))];
    case "lastWeek":
      return [iso(add(weekStart, -7)), iso(add(weekStart, -1))];
    case "thisMonth":
      return [iso(monthStart), iso(today)];
    case "last90Days":
      return [iso(add(today, -89)), iso(today)];
    default:
      return [iso(add(today, -29)), iso(today)];
  }
}

export function appointments(ctx: DemoContext, range: string, status: string): Appointment[] {
  const [from, to] = rangeBounds(range);
  const rows = ALL.filter(
    (a) => a.date >= from && a.date <= to && (status === "all" || a.status === status),
  );
  // Permission check lives in the host's data layer.
  if (!ctx.permissions.includes("finance.read"))
    return rows.map(({ revenue: _r, ...rest }) => rest);
  return rows;
}

export function metrics(ctx: DemoContext, range: string, status: string, groupBy: string) {
  const rows = appointments({ ...ctx, permissions: ["finance.read"] }, range, status);
  const completed = rows.filter((r) => r.status === "completed");
  const base = {
    visits: completed.length,
    noShows: rows.filter((r) => r.status === "noShow").length,
  };
  if (!ctx.permissions.includes("finance.read")) return base;
  const revenue = completed.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const buckets = new Map<string, number>();
  for (const r of completed) {
    const d = new Date(`${r.date}T00:00:00Z`);
    const key =
      groupBy === "month"
        ? r.date.slice(0, 7)
        : groupBy === "week"
          ? iso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000))
          : r.date;
    buckets.set(key, (buckets.get(key) ?? 0) + (r.revenue ?? 0));
  }
  const series = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, revenue: value }));
  return {
    ...base,
    revenue,
    avgRevenue: completed.length ? Math.round(revenue / completed.length) : 0,
    series,
  };
}
