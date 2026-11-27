/**
 * GitHub Issues sink for follow-ups.
 * @module @patina-ui/server/followups
 */
import {
  type Delivery,
  type FollowUp,
  type FollowUpSink,
  parseFollowUpMarker,
  renderFollowUpMarkdown,
} from "../followups.js";

export interface GitHubIssuesSinkOptions {
  /** A fine-grained token with Issues: read and write on the repository. */
  token: string;
  /** "owner/name". */
  repo: string;
  /** Labels for new issues. The first one is how later runs find them. Default ["patina-followup"]. */
  labels?: string[];
  /** Default "Customer request: ". */
  titlePrefix?: string;
  appName?: string;
  /** For closed issues: add a comment (default) or ignore the new requests. */
  onClosed?: "comment" | "skip";
  /** Default https://api.github.com (set it for GitHub Enterprise Server). */
  apiUrl?: string;
  fetch?: typeof fetch;
}

interface GitHubIssue {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  state_reason?: string | null;
  pull_request?: unknown;
}

const day = (iso: string) => iso.slice(0, 10);

/** The comment for a follow-up asked for again (markdown). */
export function askedAgainMarkdown(f: FollowUp, closedAs: string | null): string {
  const lead = closedAs ? `Still asked for after this issue was ${closedAs}:` : "Asked for again:";
  const quotes = f.examples
    .slice(0, 3)
    .map((e) => `> ${e.replace(/\n+/g, " ")}`)
    .join("\n");
  const names = f.customerNames.length ? `\n\nCustomers: ${f.customerNames.join(", ")}` : "";
  return `${lead} ${f.count}× by ${f.customers} customer${f.customers === 1 ? "" : "s"} between ${day(f.firstAt)} and ${day(f.lastAt)}.\n\n${quotes}${names}`;
}

/** Turns a failed response into an Error with the service's own message. */
export async function apiError(res: Response, service: string): Promise<Error> {
  const text = await res.text().catch(() => "");
  let detail = text.slice(0, 300);
  try {
    const body = JSON.parse(text) as {
      message?: string;
      errorMessages?: string[];
      errors?: Record<string, string> | { message?: string }[];
    };
    const parts = [
      body.message,
      ...(body.errorMessages ?? []),
      ...(Array.isArray(body.errors)
        ? body.errors.map((e) => e.message)
        : Object.values(body.errors ?? {})),
    ].filter((p): p is string => typeof p === "string" && p.length > 0);
    if (parts.length) detail = parts.join("; ");
  } catch {
    // Not JSON: keep the raw text.
  }
  return new Error(`${service} API ${res.status}: ${detail || res.statusText}`);
}

/** Files one GitHub issue per follow-up, and comments on it when it's asked for again. */
export function githubIssuesSink(options: GitHubIssuesSinkOptions): FollowUpSink {
  const doFetch = options.fetch ?? fetch;
  const api = (options.apiUrl ?? "https://api.github.com").replace(/\/+$/, "");
  const labels = options.labels?.length ? options.labels : ["patina-followup"];
  const findLabel = labels[0] as string;
  const prefix = options.titlePrefix ?? "Customer request: ";
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repo))
    throw new Error(`githubIssuesSink: repo must look like "owner/name", got "${options.repo}"`);

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "patina-ui",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw await apiError(res, "GitHub");
    return (await res.json()) as T;
  }

  let cache: Map<string, GitHubIssue> | null = null;
  async function existing(): Promise<Map<string, GitHubIssue>> {
    if (cache) return cache;
    const found = new Map<string, GitHubIssue>();
    for (let page = 1; page <= 10; page++) {
      const issues = await call<GitHubIssue[]>(
        "GET",
        `/repos/${options.repo}/issues?labels=${encodeURIComponent(findLabel)}&state=all&per_page=100&page=${page}`,
      );
      for (const issue of issues) {
        if (issue.pull_request) continue;
        const key = parseFollowUpMarker(issue.body);
        if (key && !found.has(key)) found.set(key, issue);
      }
      if (issues.length < 100) break;
    }
    cache = found;
    return found;
  }

  const closedAs = (i: GitHubIssue) =>
    i.state !== "closed"
      ? null
      : i.state_reason === "not_planned"
        ? "closed as not planned"
        : "completed";

  return {
    name: "github",
    async known() {
      const issues = await existing();
      return [...issues.entries()]
        .filter(([, i]) => !(i.state === "closed" && i.state_reason === "not_planned"))
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
          const closed = closedAs(issue);
          const ref = `#${issue.number}`;
          if (closed && options.onClosed === "skip") {
            out.push({
              sink: "github",
              key: f.key,
              action: "skipped",
              url: issue.html_url,
              ref,
              note: `issue is ${closed}`,
            });
            continue;
          }
          await call("POST", `/repos/${options.repo}/issues/${issue.number}/comments`, {
            body: askedAgainMarkdown(f, closed),
          });
          out.push({ sink: "github", key: f.key, action: "updated", url: issue.html_url, ref });
          continue;
        }
        const created = await call<GitHubIssue>("POST", `/repos/${options.repo}/issues`, {
          title: `${prefix}${f.title}`,
          body: renderFollowUpMarkdown(f, { appName: options.appName }),
          labels,
        });
        issues.set(f.key, created);
        out.push({
          sink: "github",
          key: f.key,
          action: "created",
          url: created.html_url,
          ref: `#${created.number}`,
        });
      }
      return out;
    },
  };
}
