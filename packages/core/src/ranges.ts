import { RELATIVE_RANGES, type RelativeRange } from "./dsl.js";

const BY_LOWER = new Map(RELATIVE_RANGES.map((r) => [r.toLowerCase(), r]));

/** The relative range a value names ("last7days", "last7Days", "thisWeek"), or null. */
export function asRelativeRange(value: unknown): RelativeRange | null {
  if (typeof value === "object" && value && "relative" in value)
    value = (value as { relative: unknown }).relative;
  return typeof value === "string" ? (BY_LOWER.get(value.toLowerCase()) ?? null) : null;
}

/**
 * Start (inclusive) and end (exclusive) of a relative range in local time, as Dates.
 * "last7Days" is the 7 days before today plus today, like most date filters.
 */
export function rangeBounds(
  range: RelativeRange,
  now: Date = new Date(),
  options: { weekStartsOn?: 0 | 1 } = {},
): { from: Date; to: Date } {
  const day = (offset: number, base = now) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  const today = day(0);
  const tomorrow = day(1);
  const weekStart = day(-((now.getDay() - (options.weekStartsOn ?? 1) + 7) % 7));
  switch (range) {
    case "today":
      return { from: today, to: tomorrow };
    case "yesterday":
      return { from: day(-1), to: today };
    case "thisWeek":
      return { from: weekStart, to: tomorrow };
    case "lastWeek":
      return { from: day(-7, weekStart), to: weekStart };
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrow };
    case "lastMonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    case "last7Days":
      return { from: day(-7), to: tomorrow };
    case "last30Days":
      return { from: day(-30), to: tomorrow };
    case "last90Days":
      return { from: day(-90), to: tomorrow };
    case "thisYear":
      return { from: new Date(now.getFullYear(), 0, 1), to: tomorrow };
  }
}
