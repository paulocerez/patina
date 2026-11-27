/**
 * Insights: what customers asked for, what was applied, and what couldn't be done and why.
 * Built from the request log (`StorageAdapter.listRequests`). Pure summarization: no model calls.
 */
import type { RequestEvent, RequestFilter, RequestOutcome, StorageAdapter } from "./storage.js";

export interface UnmetRequest {
  /** The most common wording of this request. */
  prompt: string;
  count: number;
  tenants: number;
  users: number;
  /** Why it couldn't be done (reason codes, most common first). */
  reasons: string[];
  surfaces: string[];
  lastAt: string;
}

export interface ReasonCount {
  reason: string;
  source: RequestEvent["source"];
  /** Human description of the reason code. */
  label: string;
  count: number;
  tenants: number;
  users: number;
  examples: string[];
}

export interface InsightsReport {
  period: { since: string | null; until: string | null };
  /** Customization requests (prompts), not counting the later "applied" events. */
  requests: number;
  outcomes: Record<RequestOutcome, number>;
  /** Share of requests that ended with a change applied. */
  appliedRate: number | null;
  /** Share of requests that couldn't be done (refused or unavailable). */
  unmetRate: number | null;
  customers: { tenants: number; users: number };
  /** Why requests weren't fulfilled: refusals, unavailability, quotas, errors. */
  reasons: ReasonCount[];
  /** The most-asked things that couldn't be done, grouped by (normalized) wording. */
  unmet: UnmetRequest[];
  surfaces: { surfaceId: string; requests: number; applied: number; unmet: number }[];
  /** True if the log had more rows than were read; narrow the period for exact numbers. */
  truncated: boolean;
}

export const REASON_LABELS: Record<string, string> = {
  data_access: "Wanted data they can't see (other users, hidden records)",
  action: "Wanted to do something to data (delete, edit, send, export)",
  new_component: "Wanted a kind of component that doesn't exist here",
  styling: "Wanted styling (colors, fonts, custom CSS)",
  not_on_page: "Referred to something not on this page or in its data",
  unclear: "Too unclear to act on",
  other: "Other",
  safety: "Declined by the model's safety checks",
  no_change: "Nothing on the page matched",
  customize_off: "Customizing is turned off for them (availability)",
  data_views_off: "Data views aren't on their plan (availability)",
  quota_user: "Monthly quota used up (user)",
  quota_tenant: "Monthly quota used up (organization)",
  rate_limit: "Too many requests per minute",
  model_unavailable: "The model was unreachable",
  internal: "Internal error",
  preset_not_allowed: "Asked to add something that isn't offered",
  not_customizable: "Asked to change a setting that isn't open",
  unknown_prop: "Asked for a setting that doesn't exist",
  invalid_value: "Asked for a value outside the allowed range",
  unknown_node: "Referred to a part of the page that doesn't exist",
  unknown_key: "Referred to an item that doesn't exist (or isn't visible to them)",
  cannot_remove_base_item: "Asked to remove a built-in part (it can only be hidden)",
};

const UNMET: RequestOutcome[] = ["refused", "unavailable"];
const FILLERS =
  /^(please |pls |can you |could you |would you |can i |i want to |i'd like to |i would like to |i want |i need |let me |we need |hey |hi )+/;

/** Lowercase, no punctuation, no polite filler: "Please add a delete button!" → "add a delete button". */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(FILLERS, "")
    .replace(/ please$/, "")
    .trim();
}

/** Summarizes request-log events into an insights report. */
export function summarizeRequests(
  events: RequestEvent[],
  period: InsightsReport["period"] = { since: null, until: null },
  truncated = false,
): InsightsReport {
  const outcomes: Record<RequestOutcome, number> = {
    proposed: 0,
    applied: 0,
    refused: 0,
    clarified: 0,
    unavailable: 0,
    over_quota: 0,
    error: 0,
  };
  for (const e of events) outcomes[e.outcome]++;
  const requests = events.length - outcomes.applied;
  const unmetCount = outcomes.refused + outcomes.unavailable;
  const tenantsOf = (es: RequestEvent[]) =>
    new Set(es.map((e) => e.tenantId ?? `user:${e.userId}`)).size;
  const usersOf = (es: RequestEvent[]) =>
    new Set(es.map((e) => `${e.tenantId ?? ""}/${e.userId}`)).size;

  const byReason = new Map<string, RequestEvent[]>();
  for (const e of events)
    if (e.outcome !== "proposed" && e.outcome !== "applied" && e.outcome !== "clarified") {
      const k = `${e.source ?? ""}|${e.reason ?? "unknown"}`;
      byReason.set(k, [...(byReason.get(k) ?? []), e]);
    }
  const reasons: ReasonCount[] = [...byReason.entries()]
    .map(([k, es]) => {
      const [source, reason] = k.split("|") as [string, string];
      return {
        reason,
        source: (source || null) as RequestEvent["source"],
        label: REASON_LABELS[reason] ?? reason,
        count: es.length,
        tenants: tenantsOf(es),
        users: usersOf(es),
        examples: [...new Set(es.map((e) => e.prompt).filter((p): p is string => !!p))].slice(0, 3),
      };
    })
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const groups = new Map<string, RequestEvent[]>();
  for (const e of events)
    if (UNMET.includes(e.outcome) && e.prompt) {
      const k = normalizePrompt(e.prompt);
      if (k) groups.set(k, [...(groups.get(k) ?? []), e]);
    }
  const unmet: UnmetRequest[] = [...groups.values()]
    .map((es) => {
      const latest = [...es].sort((a, b) => b.at.localeCompare(a.at))[0] as RequestEvent;
      // Show the most common wording (ties: the most recent).
      const wordings = new Map<string, number>();
      for (const e of es)
        wordings.set(e.prompt as string, (wordings.get(e.prompt as string) ?? 0) + 1);
      const wording = [...wordings.entries()].sort(
        (a, b) => b[1] - a[1] || (a[0] === latest.prompt ? -1 : b[0] === latest.prompt ? 1 : 0),
      )[0]?.[0] as string;
      const reasonCounts = new Map<string, number>();
      for (const e of es)
        reasonCounts.set(e.reason ?? "unknown", (reasonCounts.get(e.reason ?? "unknown") ?? 0) + 1);
      return {
        prompt: wording,
        count: es.length,
        tenants: tenantsOf(es),
        users: usersOf(es),
        reasons: [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r),
        surfaces: [...new Set(es.map((e) => e.surfaceId))].sort(),
        lastAt: latest.at,
      };
    })
    // Most customers first, then most requests: breadth of demand matters more than one loud user.
    .sort((a, b) => b.tenants - a.tenants || b.count - a.count || b.lastAt.localeCompare(a.lastAt))
    .slice(0, 50);

  const bySurface = new Map<string, { requests: number; applied: number; unmet: number }>();
  for (const e of events) {
    const row = bySurface.get(e.surfaceId) ?? { requests: 0, applied: 0, unmet: 0 };
    if (e.outcome === "applied") row.applied++;
    else row.requests++;
    if (UNMET.includes(e.outcome)) row.unmet++;
    bySurface.set(e.surfaceId, row);
  }

  return {
    period,
    requests,
    outcomes,
    appliedRate: requests ? outcomes.applied / requests : null,
    unmetRate: requests ? unmetCount / requests : null,
    customers: { tenants: tenantsOf(events), users: usersOf(events) },
    reasons,
    unmet,
    surfaces: [...bySurface.entries()]
      .map(([surfaceId, r]) => ({ surfaceId, ...r }))
      .sort((a, b) => b.requests - a.requests),
    truncated,
  };
}

const MAX_ROWS = 10_000;

/** Reads the request log and summarizes it. Needs a storage adapter with `listRequests`. */
export async function getInsights(
  storage: StorageAdapter,
  filter: RequestFilter = {},
): Promise<InsightsReport> {
  if (!storage.listRequests)
    throw new Error("This storage adapter doesn't keep a request log (listRequests).");
  const events = await storage.listRequests({ ...filter, limit: MAX_ROWS });
  return summarizeRequests(
    events,
    { since: filter.since ?? null, until: filter.until ?? null },
    events.length >= MAX_ROWS,
  );
}

/** "30d", "12h", "4w" or an ISO date → ISO timestamp. */
export function parseSince(value: string, now = Date.now()): string {
  const m = /^(\d+)\s*([hdw])$/.exec(value.trim());
  if (m) {
    const hours = Number(m[1]) * (m[2] === "h" ? 1 : m[2] === "d" ? 24 : 24 * 7);
    return new Date(now - hours * 3_600_000).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date(now - 30 * 86_400_000).toISOString()
    : d.toISOString();
}

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 120);

export function renderInsightsMarkdown(r: InsightsReport): string {
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "the start");
  const lines = [
    "# Patina insights",
    "",
    `${r.period.since ? `${day(r.period.since)} to ${r.period.until ? day(r.period.until) : "now"}` : "All time"}: **${r.requests} requests** from ${r.customers.users} users in ${r.customers.tenants} organizations.`,
    "",
    `- Applied: ${r.outcomes.applied} (${pct(r.appliedRate)})`,
    `- Couldn't be done: ${r.outcomes.refused + r.outcomes.unavailable} (${pct(r.unmetRate)})`,
    `- Asked to clarify: ${r.outcomes.clarified} · over quota: ${r.outcomes.over_quota} · errors: ${r.outcomes.error}`,
  ];
  if (r.unmet.length) {
    lines.push(
      "",
      "## Most-requested things that couldn't be done",
      "",
      "| Request | Times | Orgs | Users | Why | Last |",
      "|---|---:|---:|---:|---|---|",
      ...r.unmet
        .slice(0, 25)
        .map(
          (u) =>
            `| ${cell(u.prompt)} | ${u.count} | ${u.tenants} | ${u.users} | ${u.reasons.join(", ")} | ${u.lastAt.slice(0, 10)} |`,
        ),
    );
  }
  if (r.reasons.length) {
    lines.push(
      "",
      "## Why requests weren't fulfilled",
      "",
      "| Reason | Decided by | Times | Orgs | Example |",
      "|---|---|---:|---:|---|",
      ...r.reasons.map(
        (x) =>
          `| ${cell(x.label)} (\`${x.reason}\`) | ${x.source ?? "–"} | ${x.count} | ${x.tenants} | ${cell(x.examples[0] ?? "")} |`,
      ),
    );
  }
  if (r.surfaces.length > 1) {
    lines.push(
      "",
      "## By view",
      "",
      "| View | Requests | Applied | Couldn't be done |",
      "|---|---:|---:|---:|",
      ...r.surfaces.map((s) => `| ${s.surfaceId} | ${s.requests} | ${s.applied} | ${s.unmet} |`),
    );
  }
  if (r.truncated)
    lines.push(
      "",
      "_Only the newest 10 000 log rows were read. Narrow the period for exact numbers._",
    );
  return `${lines.join("\n")}\n`;
}
