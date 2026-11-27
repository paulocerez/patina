/**
 * Follow-ups: turn what customers asked for but couldn't get into tickets and digests
 * (Linear, Slack, or your own sink). Built on the request log, like insights.
 *
 * Run it on a schedule (a weekly cron or GitHub Actions `schedule`) with `runFollowUps`, or
 * from the CLI with `patina followups`. Each run looks at one window of the log, groups the
 * unmet requests, keeps the ones asked often enough, and hands them to every sink. Sinks
 * de-duplicate on their side (Linear comments on the existing issue instead of filing a new one),
 * so Patina needs no extra table for this.
 * @packageDocumentation
 * @module @patina-ui/server/followups
 */
import { normalizePrompt, REASON_LABELS } from "./insights.js";
import type { RequestEvent, RequestFilter, StorageAdapter } from "./storage.js";

/** One thing customers want that the product doesn't offer yet. */
export interface FollowUp {
  /** Stable id for de-duplication across runs ("pf-" + 10 hex chars). */
  key: string;
  /** Short, imperative ticket title. */
  title: string;
  /** One or two sentences on what customers want, if a grouper wrote one. */
  summary: string | null;
  /** Requests in this window. */
  count: number;
  /** Distinct customers (tenants) and users who asked. */
  customers: number;
  users: number;
  /** Reason codes, most common first, and their descriptions. */
  reasons: { code: string; label: string; count: number }[];
  surfaces: string[];
  /** Up to five distinct wordings, redacted. */
  examples: string[];
  /** Customer names from `customerName`, if you provided it (most requests first). */
  customerNames: string[];
  /**
   * Who asked: one row per user and surface. Ids stay on your server: the built-in ticket and
   * chat sinks never send them. Used to tell these users when it ships (`shipFollowUp`) and by
   * per-customer sinks (HubSpot) to find the account.
   */
  requesters: Requester[];
  firstAt: string;
  lastAt: string;
  /** The window this run looked at. */
  window: { since: string; until: string };
}

export interface Requester {
  tenantId: string | null;
  userId: string;
  surfaceId: string;
  count: number;
}

function requestersOf(es: RequestEvent[]): Requester[] {
  const map = new Map<string, Requester>();
  for (const e of es) {
    const k = JSON.stringify([e.tenantId, e.userId, e.surfaceId]);
    const r = map.get(k) ?? {
      tenantId: e.tenantId,
      userId: e.userId,
      surfaceId: e.surfaceId,
      count: 0,
    };
    r.count++;
    map.set(k, r);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function mergeRequesters(a: Requester[], b: Requester[]): Requester[] {
  const map = new Map<string, Requester>();
  for (const r of [...a, ...b]) {
    const k = JSON.stringify([r.tenantId, r.userId, r.surfaceId]);
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, count: prev.count + r.count } : { ...r });
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

/** What a sink already filed, so a grouper can attach new requests to it. */
export interface KnownFollowUp {
  key: string;
  title: string;
}

export interface Delivery {
  sink: string;
  key: string;
  action: "created" | "updated" | "skipped" | "posted";
  url?: string;
  /** e.g. "ENG-123". */
  ref?: string;
  note?: string;
}

/** Where follow-ups go. Implement it for Jira, GitHub Issues, email, a webhook… */
export interface FollowUpSink {
  name: string;
  /** Follow-ups this sink already has (e.g. open Linear issues), for grouping and de-duplication. */
  known?(): Promise<KnownFollowUp[]>;
  /**
   * Receives this run's follow-ups and the deliveries of the sinks before it (so a Slack digest
   * can link the Linear issues). Sinks run in the order given.
   */
  deliver(items: FollowUp[], earlier: Delivery[]): Promise<Delivery[]>;
}

/** One normalized wording and its events, the unit a grouper works with. */
export interface RequestCluster {
  /** Most common wording, redacted. */
  prompt: string;
  count: number;
  customers: number;
  reasons: string[];
}

export interface FollowUpGroup {
  /** Indexes into the clusters passed to the grouper. */
  members: number[];
  title: string;
  summary?: string;
  /** Set when the group continues a known follow-up. */
  key?: string;
}

/**
 * Merges clusters that ask for the same thing (different wordings or languages) and writes
 * titles. Without one, each wording is its own follow-up. See `anthropicGrouper`.
 */
export type FollowUpGrouper = (
  clusters: RequestCluster[],
  known: KnownFollowUp[],
) => Promise<FollowUpGroup[]>;

/**
 * Reasons that point at something to build. Left out by default: data_access (a permission
 * boundary, not demand), safety, unclear, no_change, quotas, rate limits, errors, and the
 * plan/availability reasons (pass them in `reasons` to send sales signals instead).
 */
export const DEMAND_REASONS = [
  "new_component",
  "styling",
  "action",
  "not_on_page",
  "preset_not_allowed",
  "not_customizable",
  "unknown_prop",
  "invalid_value",
  "cannot_remove_base_item",
];

export interface FollowUpOptions {
  storage: StorageAdapter;
  sinks: FollowUpSink[];
  /** Start of the window, ISO. Default: 7 days ago. Match it to how often you run this. */
  since?: string;
  until?: string;
  surfaceId?: string;
  /** Reason codes to include. Default `DEMAND_REASONS`. */
  reasons?: string[];
  /** Minimum requests in the window for a follow-up. Default 2. */
  minRequests?: number;
  /** Minimum distinct customers. Default 1. */
  minCustomers?: number;
  /** At most this many follow-ups per run, most customers first. Default 10. */
  maxItems?: number;
  grouper?: FollowUpGrouper;
  /**
   * Customer names for tickets, from a tenant id (your CRM or accounts table). Off by default:
   * tickets then say "3 customers" without naming them.
   */
  customerName?(tenantId: string): string | null | Promise<string | null>;
  /**
   * Cleans prompt text before it leaves your system. Default `redact`: removes email addresses,
   * URLs, phone and long account numbers. Return null to leave an example out.
   */
  redact?(prompt: string): string | null;
  /** Compute and return the follow-ups without calling any sink's `deliver`. */
  dryRun?: boolean;
  /**
   * Remember who asked for each delivered follow-up, so they can be told when it ships
   * (`shipFollowUp`, `followUpWebhook`). Default: on if the storage supports it.
   */
  link?: boolean;
  now?: () => number;
}

export interface FollowUpRun {
  window: { since: string; until: string };
  /** Unmet requests in the window with a matching reason. */
  considered: number;
  followUps: FollowUp[];
  deliveries: Delivery[];
  /** Sinks that failed, with the error; the other sinks still ran. */
  errors: { sink: string; error: string }[];
  truncated: boolean;
}

const MAX_ROWS = 10_000;

/** Default redaction: email addresses, URLs, IBANs, phone and other long numbers. */
export function redact(prompt: string): string {
  return prompt
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link]")
    .replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, "[iban]")
    .replace(/\+?\d[\d ()/.-]{6,}\d/g, "[number]")
    .trim();
}

/** FNV-1a, 40 bits as hex: stable keys without a crypto dependency. */
export function followUpKey(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of normalizePrompt(text)) {
    const c = ch.codePointAt(0) ?? 0;
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `pf-${h1.toString(16).padStart(8, "0")}${(h2 & 0xff).toString(16).padStart(2, "0")}`;
}

/** The marker sinks put in tickets so later runs find them. */
export function followUpMarker(key: string): string {
  return `patina-followup:${key}`;
}

const MARKER = /patina-followup:(pf-[0-9a-f]{10})/;

export function parseFollowUpMarker(text: string | null | undefined): string | null {
  return text?.match(MARKER)?.[1] ?? null;
}

function titleFrom(prompt: string): string {
  const t = prompt.trim().replace(/[.!?]+$/, "");
  const capped = t.length > 80 ? `${t.slice(0, 77).trimEnd()}…` : t;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

function mostCommon(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** Groups unmet requests into follow-ups. Pure apart from the grouper and `customerName`. */
export async function buildFollowUps(
  events: RequestEvent[],
  options: Omit<FollowUpOptions, "storage" | "sinks" | "dryRun"> & {
    window: { since: string; until: string };
    known?: KnownFollowUp[];
  },
): Promise<{ considered: number; followUps: FollowUp[] }> {
  const reasons = new Set(options.reasons ?? DEMAND_REASONS);
  const clean = options.redact ?? redact;
  const relevant = events.filter(
    (e) =>
      (e.outcome === "refused" || e.outcome === "unavailable") &&
      e.prompt &&
      reasons.has(e.reason ?? ""),
  );

  // 1. Same wording (after normalizing) → one cluster.
  const byWording = new Map<string, RequestEvent[]>();
  for (const e of relevant) {
    const k = normalizePrompt(e.prompt as string);
    if (k) byWording.set(k, [...(byWording.get(k) ?? []), e]);
  }
  const clusterEvents = [...byWording.values()];
  const customersOf = (es: RequestEvent[]) =>
    new Set(es.map((e) => e.tenantId ?? `user:${e.userId}`)).size;
  const clusters: RequestCluster[] = clusterEvents.map((es) => ({
    prompt: clean(mostCommon(es.map((e) => e.prompt as string))[0] as string) ?? "",
    count: es.length,
    customers: customersOf(es),
    reasons: mostCommon(es.map((e) => e.reason ?? "unknown")),
  }));

  // 2. Clusters → groups (by the grouper, or one per cluster).
  let groups: FollowUpGroup[];
  if (options.grouper && clusters.length > 0) {
    const raw = await options.grouper(clusters, options.known ?? []);
    const seen = new Set<number>();
    groups = [];
    for (const g of raw) {
      const members: number[] = [];
      for (const i of g.members)
        if (Number.isInteger(i) && i >= 0 && i < clusters.length && !seen.has(i)) {
          seen.add(i);
          members.push(i);
        }
      if (members.length && g.title?.trim()) groups.push({ ...g, members });
    }
    // Anything the grouper left out stays its own follow-up.
    clusters.forEach((c, i) => {
      if (!seen.has(i)) groups.push({ members: [i], title: titleFrom(c.prompt) });
    });
  } else {
    groups = clusters.map((c, i) => ({ members: [i], title: titleFrom(c.prompt) }));
  }

  const knownKeys = new Set((options.known ?? []).map((k) => k.key));
  const minRequests = options.minRequests ?? 2;
  const minCustomers = options.minCustomers ?? 1;

  const followUps: FollowUp[] = [];
  for (const g of groups) {
    const es = g.members.flatMap((i) => clusterEvents[i] as RequestEvent[]);
    const customers = customersOf(es);
    if (es.length < minRequests || customers < minCustomers) continue;
    const sorted = [...es].sort((a, b) => a.at.localeCompare(b.at));
    const reasonCodes = mostCommon(es.map((e) => e.reason ?? "unknown"));
    const examples: string[] = [];
    for (const p of mostCommon(es.map((e) => e.prompt as string))) {
      const r = clean(p);
      if (r && !examples.includes(r)) examples.push(r);
      if (examples.length === 5) break;
    }
    const key =
      g.key && knownKeys.has(g.key)
        ? g.key
        : followUpKey(clusters[g.members[0] as number]?.prompt || g.title);
    let customerNames: string[] = [];
    if (options.customerName) {
      const tenants = mostCommon(es.flatMap((e) => (e.tenantId ? [e.tenantId] : [])));
      const names = await Promise.all(tenants.map((t) => options.customerName?.(t)));
      customerNames = names.filter((n): n is string => !!n);
    }
    followUps.push({
      key,
      title: g.title.trim().slice(0, 120),
      summary: g.summary?.trim() || null,
      count: es.length,
      customers,
      users: new Set(es.map((e) => `${e.tenantId ?? ""}/${e.userId}`)).size,
      reasons: reasonCodes.map((code) => ({
        code,
        label: REASON_LABELS[code] ?? code,
        count: es.filter((e) => (e.reason ?? "unknown") === code).length,
      })),
      surfaces: [...new Set(es.map((e) => e.surfaceId))].sort(),
      examples,
      customerNames,
      requesters: requestersOf(es),
      firstAt: sorted[0]?.at as string,
      lastAt: sorted.at(-1)?.at as string,
      window: options.window,
    });
  }

  // Two groups can land on the same key (e.g. both continue one known issue): merge them.
  const byKey = new Map<string, FollowUp>();
  for (const f of followUps) {
    const prev = byKey.get(f.key);
    if (!prev) byKey.set(f.key, f);
    else
      byKey.set(f.key, {
        ...prev,
        count: prev.count + f.count,
        customers: Math.max(prev.customers, f.customers),
        users: Math.max(prev.users, f.users),
        examples: [...new Set([...prev.examples, ...f.examples])].slice(0, 5),
        requesters: mergeRequesters(prev.requesters, f.requesters),
        // biome-ignore lint/complexity/useMathMinMax: ISO strings, not numbers
        firstAt: prev.firstAt < f.firstAt ? prev.firstAt : f.firstAt,
        // biome-ignore lint/complexity/useMathMinMax: ISO strings, not numbers
        lastAt: prev.lastAt > f.lastAt ? prev.lastAt : f.lastAt,
      });
  }

  return {
    considered: relevant.length,
    followUps: [...byKey.values()]
      // Breadth of demand first, like insights.
      .sort((a, b) => b.customers - a.customers || b.count - a.count)
      .slice(0, options.maxItems ?? 10),
  };
}

/** Reads one window of the request log, builds follow-ups and delivers them to every sink. */
export async function runFollowUps(options: FollowUpOptions): Promise<FollowUpRun> {
  const { storage, sinks } = options;
  if (!storage.listRequests)
    throw new Error(
      "Follow-ups need the request log: a storage adapter with listRequests (memory or Postgres).",
    );
  const now = options.now?.() ?? Date.now();
  const window = {
    since: options.since ?? new Date(now - 7 * 86_400_000).toISOString(),
    until: options.until ?? new Date(now).toISOString(),
  };
  const filter: RequestFilter = {
    since: window.since,
    // Without an explicit end, read up to now (inclusive of anything logged this instant).
    ...(options.until ? { until: options.until } : {}),
    outcomes: ["refused", "unavailable"],
    ...(options.surfaceId ? { surfaceId: options.surfaceId } : {}),
    limit: MAX_ROWS,
  };
  const events = await storage.listRequests(filter);
  const errors: FollowUpRun["errors"] = [];

  const known: KnownFollowUp[] = [];
  for (const sink of sinks) {
    if (!sink.known) continue;
    try {
      known.push(...(await sink.known()));
    } catch (e) {
      errors.push({ sink: sink.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const { considered, followUps } = await buildFollowUps(events, { ...options, window, known });

  const deliveries: Delivery[] = [];
  if (!options.dryRun && followUps.length > 0)
    for (const sink of sinks) {
      try {
        deliveries.push(...(await sink.deliver(followUps, deliveries)));
      } catch (e) {
        errors.push({ sink: sink.name, error: e instanceof Error ? e.message : String(e) });
      }
    }

  // Link users to the follow-ups that reached at least one sink.
  const delivered = new Set(deliveries.filter((d) => d.action !== "skipped").map((d) => d.key));
  if (!options.dryRun && options.link !== false && storage.linkFollowUp)
    for (const f of followUps) {
      if (!delivered.has(f.key)) continue;
      try {
        await storage.linkFollowUp({
          key: f.key,
          title: f.title,
          requesters: f.requesters.map(({ tenantId, userId, surfaceId }) => ({
            tenantId,
            userId,
            surfaceId,
          })),
        });
      } catch (e) {
        errors.push({ sink: "storage", error: e instanceof Error ? e.message : String(e) });
      }
    }

  return {
    window,
    considered,
    followUps,
    deliveries,
    errors,
    truncated: events.length >= MAX_ROWS,
  };
}

const day = (iso: string) => iso.slice(0, 10);

/** Markdown body for a ticket (Linear, GitHub, Jira all render it). */
export function renderFollowUpMarkdown(f: FollowUp, opts: { appName?: string } = {}): string {
  const who = f.customers === 1 ? "1 customer" : `${f.customers} customers (${f.users} users)`;
  const lines = [
    f.summary ?? "",
    "",
    `**Asked ${f.count} time${f.count === 1 ? "" : "s"} by ${who}** between ${day(f.firstAt)} and ${day(f.lastAt)}${opts.appName ? ` in ${opts.appName}` : ""}.`,
    "",
    "**What they wrote**",
    ...f.examples.map((e) => `> ${e.replace(/\n+/g, " ")}`),
    "",
    "**Why it couldn't be done**",
    ...f.reasons.map((r) => `- ${r.label} (\`${r.code}\`, ${r.count}×)`),
    "",
    `**Where:** ${f.surfaces.map((s) => `\`${s}\``).join(", ")}`,
  ];
  if (f.customerNames.length) lines.push(`**Customers:** ${f.customerNames.join(", ")}`);
  lines.push(
    "",
    `<sub>Filed by Patina follow-ups from the request log. ${followUpMarker(f.key)}</sub>`,
  );
  return lines
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** Plain-text list for logs and `--dry-run`. */
export function renderFollowUpsText(run: FollowUpRun): string {
  const out = [
    `Follow-ups ${day(run.window.since)} → ${day(run.window.until)}: ${run.followUps.length} from ${run.considered} unmet requests${run.truncated ? " (log truncated; narrow the window)" : ""}`,
  ];
  for (const f of run.followUps) {
    out.push(
      "",
      `${f.title}  [${f.key}]`,
      `  ${f.count}× by ${f.customers} customer(s); ${f.reasons.map((r) => r.code).join(", ")}`,
      ...f.examples.slice(0, 3).map((e) => `  “${e}”`),
    );
    for (const d of run.deliveries.filter((d) => d.key === f.key))
      out.push(`  → ${d.sink}: ${d.action}${d.ref ? ` ${d.ref}` : ""}${d.url ? ` ${d.url}` : ""}`);
  }
  for (const e of run.errors) out.push("", `! ${e.sink} failed: ${e.error}`);
  return out.join("\n");
}

// ─── Linear ──────────────────────────────────────────────────────────────────────────────

export interface LinearSinkOptions {
  /** A Linear API key (Settings → Security & access → Personal API keys). */
  apiKey: string;
  /** The team new issues go to (its UUID). */
  teamId: string;
  /** Labels for new issues, e.g. a "customer request" label. */
  labelIds?: string[];
  /** Workflow state for new issues (e.g. Triage). Default: the team's default. */
  stateId?: string;
  /** Linear priority 0–4 (0 none, 1 urgent … 4 low). Default 0. */
  priority?: number;
  /** Prefix for titles. Default "Customer request: ". */
  titlePrefix?: string;
  /** Shown in the ticket ("… in Vetpal"). */
  appName?: string;
  /**
   * What to do when the matching issue is done or canceled. "comment" (default) adds the new
   * requests as a comment, which tells you it still isn't possible for customers; "skip" ignores them.
   */
  onClosed?: "comment" | "skip";
  /** Default https://api.linear.app/graphql. */
  endpoint?: string;
  fetch?: typeof fetch;
}

interface LinearIssue {
  id: string;
  identifier: string;
  url: string;
  title: string;
  description: string | null;
  state: { type: string } | null;
}

/** Files one Linear issue per follow-up, and comments on it when it's asked for again. */
export function linearSink(options: LinearSinkOptions): FollowUpSink {
  const doFetch = options.fetch ?? fetch;
  const endpoint = options.endpoint ?? "https://api.linear.app/graphql";
  const prefix = options.titlePrefix ?? "Customer request: ";

  async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: options.apiKey },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (!res.ok || body.errors?.length || !body.data)
      throw new Error(
        `Linear API ${res.status}: ${body.errors?.map((e) => e.message).join("; ") || res.statusText}`,
      );
    return body.data;
  }

  let cache: Map<string, LinearIssue> | null = null;
  async function existing(): Promise<Map<string, LinearIssue>> {
    if (cache) return cache;
    const found = new Map<string, LinearIssue>();
    let after: string | null = null;
    for (let page = 0; page < 10; page++) {
      const data: {
        issues: {
          nodes: LinearIssue[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } = await gql(
        `query PatinaFollowUps($teamId: ID!, $after: String) {
          issues(first: 100, after: $after, includeArchived: false,
                 filter: { team: { id: { eq: $teamId } }, description: { contains: "patina-followup:" } }) {
            nodes { id identifier url title description state { type } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { teamId: options.teamId, after },
      );
      for (const issue of data.issues.nodes) {
        const key = parseFollowUpMarker(issue.description);
        if (key && !found.has(key)) found.set(key, issue);
      }
      if (!data.issues.pageInfo.hasNextPage) break;
      after = data.issues.pageInfo.endCursor;
    }
    cache = found;
    return found;
  }

  return {
    name: "linear",
    async known() {
      const issues = await existing();
      return [...issues.entries()]
        .filter(([, i]) => i.state?.type !== "canceled")
        .map(([key, i]) => ({
          key,
          title: i.title.startsWith(prefix) ? i.title.slice(prefix.length) : i.title,
        }));
    },
    async deliver(items) {
      const issues = await existing();
      const out: Delivery[] = [];
      for (const f of items) {
        const issue = issues.get(f.key);
        if (issue) {
          const closed = issue.state?.type === "completed" || issue.state?.type === "canceled";
          if (closed && options.onClosed === "skip") {
            out.push({
              sink: "linear",
              key: f.key,
              action: "skipped",
              url: issue.url,
              ref: issue.identifier,
              note: `issue is ${issue.state?.type}`,
            });
            continue;
          }
          const lead = closed
            ? `Still asked for after this issue was ${issue.state?.type === "completed" ? "completed" : "canceled"}:`
            : "Asked for again:";
          const body = `${lead} ${f.count}× by ${f.customers} customer${f.customers === 1 ? "" : "s"} between ${day(f.firstAt)} and ${day(f.lastAt)}.\n\n${f.examples
            .slice(0, 3)
            .map((e) => `> ${e.replace(/\n+/g, " ")}`)
            .join(
              "\n",
            )}${f.customerNames.length ? `\n\nCustomers: ${f.customerNames.join(", ")}` : ""}`;
          await gql(
            `mutation PatinaFollowUpComment($input: CommentCreateInput!) {
              commentCreate(input: $input) { success }
            }`,
            { input: { issueId: issue.id, body } },
          );
          out.push({
            sink: "linear",
            key: f.key,
            action: "updated",
            url: issue.url,
            ref: issue.identifier,
          });
          continue;
        }
        const data = await gql<{
          issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
        }>(
          `mutation PatinaFollowUpCreate($input: IssueCreateInput!) {
            issueCreate(input: $input) { success issue { id identifier url } }
          }`,
          {
            input: {
              teamId: options.teamId,
              title: `${prefix}${f.title}`,
              description: renderFollowUpMarkdown(f, { appName: options.appName }),
              ...(options.labelIds?.length ? { labelIds: options.labelIds } : {}),
              ...(options.stateId ? { stateId: options.stateId } : {}),
              ...(options.priority ? { priority: options.priority } : {}),
            },
          },
        );
        const created = data.issueCreate.issue;
        issues.set(f.key, {
          ...created,
          title: `${prefix}${f.title}`,
          description: followUpMarker(f.key),
          state: null,
        });
        out.push({
          sink: "linear",
          key: f.key,
          action: "created",
          url: created.url,
          ref: created.identifier,
        });
      }
      return out;
    },
  };
}

// ─── Slack ───────────────────────────────────────────────────────────────────────────────

export interface SlackSinkOptions {
  /** An incoming-webhook URL (a Slack app with "Incoming Webhooks", bound to one channel). */
  webhookUrl: string;
  /** Shown in the header ("Vetpal: what customers couldn't do this week"). */
  appName?: string;
  /** Link to your insights page or dashboard, shown at the bottom. */
  insightsUrl?: string;
  fetch?: typeof fetch;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Slack Block Kit message for a digest. Exported for custom senders (bot tokens, threads). */
export function renderSlackDigest(
  items: FollowUp[],
  earlier: Delivery[],
  opts: { appName?: string; insightsUrl?: string } = {},
): { text: string; blocks: unknown[] } {
  const first = items[0];
  const window = first ? `${day(first.window.since)} – ${day(first.window.until)}` : "";
  const heading = `${opts.appName ? `${opts.appName}: ` : ""}what customers asked for but couldn't do`;
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: heading.slice(0, 150), emoji: false } },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${window} · ${items.length} request${items.length === 1 ? "" : "s"} from Patina's log`,
        },
      ],
    },
  ];
  for (const f of items.slice(0, 15)) {
    const links = earlier
      .filter((d) => d.key === f.key && d.url)
      .map((d) => `<${d.url}|${esc(d.ref ?? d.sink)}>${d.action === "created" ? " (new)" : ""}`);
    const quote = f.examples[0]
      ? `\n> ${esc(f.examples[0].replace(/\n+/g, " ")).slice(0, 300)}`
      : "";
    const who = f.customerNames.length ? ` · ${esc(f.customerNames.slice(0, 5).join(", "))}` : "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${esc(f.title)}*${links.length ? `  ${links.join(" ")}` : ""}\n${f.count}× · ${f.customers} customer${f.customers === 1 ? "" : "s"} · ${esc(f.reasons[0]?.label ?? "")}${who}${quote}`.slice(
          0,
          2900,
        ),
      },
    });
  }
  if (opts.insightsUrl)
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `<${opts.insightsUrl}|Full insights report>` }],
    });
  return {
    text: esc(`${heading}: ${items.map((f) => f.title).join("; ")}`).slice(0, 3000),
    blocks,
  };
}

/** Posts one digest message per run. Put it after the Linear sink to link the issues. */
export function slackSink(options: SlackSinkOptions): FollowUpSink {
  const doFetch = options.fetch ?? fetch;
  return {
    name: "slack",
    async deliver(items, earlier) {
      const res = await doFetch(options.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderSlackDigest(items, earlier, options)),
      });
      if (!res.ok)
        throw new Error(`Slack webhook ${res.status}: ${await res.text().catch(() => "")}`);
      return items.map((f) => ({ sink: "slack", key: f.key, action: "posted" as const }));
    },
  };
}

// ─── Webhook ─────────────────────────────────────────────────────────────────────────────

/** POSTs the follow-ups as JSON to your own endpoint (Zapier, n8n, an internal service). */
export function webhookSink(options: {
  url: string;
  /** Include who asked (tenant and user ids). Default false. */
  includeRequesters?: boolean;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): FollowUpSink {
  const doFetch = options.fetch ?? fetch;
  return {
    name: "webhook",
    async deliver(items, earlier) {
      const res = await doFetch(options.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...options.headers },
        body: JSON.stringify({
          followUps: options.includeRequesters ? items : items.map(({ requesters: _r, ...f }) => f),
          deliveries: earlier,
        }),
      });
      if (!res.ok) throw new Error(`Webhook ${res.status}`);
      return items.map((f) => ({ sink: "webhook", key: f.key, action: "posted" as const }));
    },
  };
}

// ─── Shipped: tell the users who asked ───────────────────────────────────────────────────

/**
 * Marks a follow-up as shipped: everyone who asked for it sees a notice on the page where they
 * asked ("You asked for … That's now possible."), until they dismiss it. Pass `message` to use
 * your own text (e.g. with a pointer to where to find it). Returns the number of notices.
 */
export async function shipFollowUp(
  storage: StorageAdapter,
  key: string,
  message?: string | null,
): Promise<number> {
  if (!storage.shipFollowUp)
    throw new Error("This storage adapter doesn't keep follow-up links (shipFollowUp).");
  return storage.shipFollowUp(key, message ?? null);
}

export interface FollowUpWebhookOptions {
  /** Which tracker calls this webhook. */
  provider: "linear" | "github" | "jira";
  /** The webhook's signing secret. Requests without a valid signature get a 401. */
  secret: string;
  storage: StorageAdapter;
  /** Your own notice text per shipped follow-up; default: Patina's localized text. */
  message?(shipped: { key: string; title: string; url?: string }): string | null | undefined;
  /** Called after a follow-up was marked shipped. */
  onShipped?(shipped: { key: string; notices: number }): void | Promise<void>;
  now?: () => number;
}

const enc = new TextEncoder();

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const JIRA_KEY = /^pf-[0-9a-f]{10}$/;

/**
 * A fetch-style handler for your tracker's webhook. When a follow-up's issue is completed,
 * it marks the follow-up as shipped (see `shipFollowUp`). Issues closed as not planned or
 * canceled are ignored.
 *
 * - Linear: Settings → API → Webhooks, data type "Issues"; signature header `linear-signature`.
 * - GitHub: repository webhook, event "Issues", content type JSON; header `x-hub-signature-256`.
 * - Jira Cloud: admin webhook for "Issue updated" with a secret; header `x-hub-signature`.
 *
 * It needs the raw request body: with Express, mount it before `express.json()`.
 */
export function followUpWebhook(options: FollowUpWebhookOptions) {
  const ok = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const raw = await request.text();
    const header =
      options.provider === "linear"
        ? request.headers.get("linear-signature")
        : options.provider === "github"
          ? request.headers.get("x-hub-signature-256")
          : request.headers.get("x-hub-signature");
    const expected = await hmacHex(options.secret, raw);
    const given = (header ?? "").replace(/^sha256=/, "").toLowerCase();
    if (!given || !sameHex(given, expected)) return new Response("Bad signature", { status: 401 });

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    let shipped: { key: string; title: string; url?: string } | null = null;
    if (options.provider === "linear") {
      // Reject replays: Linear signs a timestamp into the payload.
      const ts = Number(payload.webhookTimestamp);
      const now = options.now?.() ?? Date.now();
      if (Number.isFinite(ts) && Math.abs(now - ts) > 5 * 60_000)
        return new Response("Stale webhook", { status: 401 });
      const data = payload.data as
        | { title?: string; description?: string; url?: string; state?: { type?: string } }
        | undefined;
      const key = parseFollowUpMarker(data?.description);
      if (payload.type === "Issue" && data?.state?.type === "completed" && key)
        shipped = { key, title: data.title ?? "", ...(data.url ? { url: data.url } : {}) };
    } else if (options.provider === "github") {
      const issue = payload.issue as
        | { title?: string; body?: string; html_url?: string; state_reason?: string }
        | undefined;
      const key = parseFollowUpMarker(issue?.body);
      if (
        request.headers.get("x-github-event") === "issues" &&
        payload.action === "closed" &&
        issue?.state_reason === "completed" &&
        key
      )
        shipped = {
          key,
          title: issue.title ?? "",
          ...(issue.html_url ? { url: issue.html_url } : {}),
        };
    } else {
      const issue = payload.issue as
        | {
            key?: string;
            fields?: {
              summary?: string;
              labels?: string[];
              status?: { statusCategory?: { key?: string } };
            };
          }
        | undefined;
      const key = issue?.fields?.labels?.find((l) => JIRA_KEY.test(l));
      if (issue?.fields?.status?.statusCategory?.key === "done" && key)
        shipped = { key, title: issue.fields?.summary ?? "" };
    }

    if (!shipped) return ok({ ignored: true });
    const notices = await shipFollowUp(options.storage, shipped.key, options.message?.(shipped));
    await options.onShipped?.({ key: shipped.key, notices });
    return ok({ shipped: shipped.key, notices });
  };
}

// ─── More sinks ──────────────────────────────────────────────────────────────────────────

export * from "./sinks/customers.js";
export * from "./sinks/github.js";
export * from "./sinks/jira.js";
