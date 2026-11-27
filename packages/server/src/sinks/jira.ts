/**
 * Jira Cloud sink for follow-ups.
 * @module @patina-ui/server/followups
 */
import { type Delivery, type FollowUpSink, renderFollowUpMarkdown } from "../followups.js";
import { apiError, askedAgainMarkdown } from "./github.js";

export interface JiraSinkOptions {
  /** e.g. "https://your-team.atlassian.net". */
  baseUrl: string;
  /** The Atlassian account email the API token belongs to. */
  email: string;
  /** An Atlassian API token (id.atlassian.com → Security → API tokens). */
  apiToken: string;
  projectKey: string;
  /** Default "Task". */
  issueType?: string;
  /** Labels for new issues. The first one is how later runs find them. Default ["patina-followup"]. */
  labels?: string[];
  /** Default "Customer request: ". */
  titlePrefix?: string;
  appName?: string;
  /** For done issues: add a comment (default) or ignore the new requests. */
  onClosed?: "comment" | "skip";
  fetch?: typeof fetch;
}

// ─── Atlassian Document Format ──────────────────────────────────────────────────────────

type AdfMark = { type: "strong" } | { type: "code" };
type AdfInline = { type: "text"; text: string; marks?: AdfMark[] } | { type: "hardBreak" };
type AdfBlock =
  | { type: "paragraph"; content: AdfInline[] }
  | { type: "blockquote"; content: AdfBlock[] }
  | { type: "bulletList"; content: { type: "listItem"; content: AdfBlock[] }[] };
export interface AdfDoc {
  type: "doc";
  version: 1;
  content: AdfBlock[];
}

function inline(line: string): AdfInline[] {
  const out: AdfInline[] = [];
  for (const part of line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      out.push({ type: "text", text: part.slice(2, -2), marks: [{ type: "strong" }] });
    else if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      out.push({ type: "text", text: part.slice(1, -1), marks: [{ type: "code" }] });
    else out.push({ type: "text", text: part });
  }
  return out;
}

function paragraph(lines: string[]): AdfBlock {
  const content: AdfInline[] = [];
  lines.forEach((l, i) => {
    if (i > 0) content.push({ type: "hardBreak" });
    content.push(...inline(l));
  });
  return { type: "paragraph", content };
}

/**
 * The small markdown subset follow-ups use (paragraphs, `> ` quotes, `- ` lists, **bold**,
 * `code`) as Atlassian Document Format. Everything else is plain text; HTML tags are removed.
 */
export function markdownToAdf(md: string): AdfDoc {
  const content: AdfBlock[] = [];
  const blocks = md
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").filter((l) => l.trim() !== ""))
    .filter((b) => b.length > 0);
  for (const lines of blocks) {
    // A block can mix a heading line with list or quote lines: split it into runs.
    const runs: { kind: "p" | "quote" | "list"; lines: string[] }[] = [];
    for (const line of lines) {
      const kind = line.startsWith(">") ? "quote" : /^[-*] /.test(line) ? "list" : "p";
      const text =
        kind === "quote" ? line.replace(/^>\s?/, "") : kind === "list" ? line.slice(2) : line;
      const last = runs.at(-1);
      if (last?.kind === kind) last.lines.push(text);
      else runs.push({ kind, lines: [text] });
    }
    for (const run of runs) {
      if (run.kind === "quote")
        content.push({ type: "blockquote", content: run.lines.map((l) => paragraph([l])) });
      else if (run.kind === "list")
        content.push({
          type: "bulletList",
          content: run.lines.map((l) => ({ type: "listItem", content: [paragraph([l])] })),
        });
      else content.push(paragraph(run.lines));
    }
  }
  return { type: "doc", version: 1, content };
}

// ─── Sink ────────────────────────────────────────────────────────────────────────────────

const KEY_LABEL = /^pf-[0-9a-f]{10}$/;

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    labels?: string[];
    status?: { name?: string; statusCategory?: { key?: string } };
  };
}

/**
 * Files one Jira issue per follow-up, and comments on it when it's asked for again. The
 * follow-up key is stored as a label (e.g. "pf-0123456789"), so later runs find the issue.
 */
export function jiraSink(options: JiraSinkOptions): FollowUpSink {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");
  const labels = options.labels?.length ? options.labels : ["patina-followup"];
  const prefix = options.titlePrefix ?? "Customer request: ";
  const auth = `Basic ${Buffer.from(`${options.email}:${options.apiToken}`).toString("base64")}`;
  const jqlString = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        authorization: auth,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw await apiError(res, "Jira");
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  let cache: Map<string, JiraIssue> | null = null;
  async function existing(): Promise<Map<string, JiraIssue>> {
    if (cache) return cache;
    const found = new Map<string, JiraIssue>();
    let nextPageToken: string | undefined;
    for (let page = 0; page < 10; page++) {
      const data = await call<{ issues?: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>(
        "POST",
        "/rest/api/3/search/jql",
        {
          jql: `project = ${jqlString(options.projectKey)} AND labels = ${jqlString(labels[0] as string)}`,
          fields: ["summary", "labels", "status"],
          maxResults: 100,
          ...(nextPageToken ? { nextPageToken } : {}),
        },
      );
      for (const issue of data.issues ?? []) {
        const key = issue.fields.labels?.find((l) => KEY_LABEL.test(l));
        if (key && !found.has(key)) found.set(key, issue);
      }
      if (!data.nextPageToken || data.isLast) break;
      nextPageToken = data.nextPageToken;
    }
    cache = found;
    return found;
  }

  const isDone = (i: JiraIssue) => i.fields.status?.statusCategory?.key === "done";
  const link = (key: string) => `${base}/browse/${key}`;

  return {
    name: "jira",
    async known() {
      const issues = await existing();
      return [...issues.entries()].map(([key, i]) => ({
        key,
        title: i.fields.summary.startsWith(prefix)
          ? i.fields.summary.slice(prefix.length)
          : i.fields.summary,
      }));
    },
    async deliver(items) {
      const issues = await existing();
      const out: Delivery[] = [];
      for (const f of items) {
        const issue = issues.get(f.key);
        if (issue) {
          const done = isDone(issue);
          if (done && options.onClosed === "skip") {
            out.push({
              sink: "jira",
              key: f.key,
              action: "skipped",
              url: link(issue.key),
              ref: issue.key,
              note: `issue is ${issue.fields.status?.name ?? "done"}`,
            });
            continue;
          }
          await call("POST", `/rest/api/3/issue/${encodeURIComponent(issue.key)}/comment`, {
            body: markdownToAdf(askedAgainMarkdown(f, done ? "done" : null)),
          });
          out.push({
            sink: "jira",
            key: f.key,
            action: "updated",
            url: link(issue.key),
            ref: issue.key,
          });
          continue;
        }
        const created = await call<{ key: string }>("POST", "/rest/api/3/issue", {
          fields: {
            project: { key: options.projectKey },
            issuetype: { name: options.issueType ?? "Task" },
            summary: `${prefix}${f.title}`.slice(0, 255),
            description: markdownToAdf(renderFollowUpMarkdown(f, { appName: options.appName })),
            labels: [...new Set([...labels, f.key])],
          },
        });
        issues.set(f.key, {
          key: created.key,
          fields: { summary: `${prefix}${f.title}`, labels: [...labels, f.key] },
        });
        out.push({
          sink: "jira",
          key: f.key,
          action: "created",
          url: link(created.key),
          ref: created.key,
        });
      }
      return out;
    },
  };
}
