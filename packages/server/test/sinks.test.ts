import { describe, expect, it } from "vitest";
import { type FollowUp, followUpKey, renderFollowUpMarkdown } from "../src/followups.js";
import { hubspotSink, perCustomerSink, renderCustomerNoteHtml } from "../src/sinks/customers.js";
import { githubIssuesSink } from "../src/sinks/github.js";
import { jiraSink, markdownToAdf } from "../src/sinks/jira.js";

function followUp(title: string, over: Partial<FollowUp> = {}): FollowUp {
  return {
    key: followUpKey(title),
    title,
    summary: null,
    count: 3,
    customers: 2,
    users: 3,
    reasons: [{ code: "new_component", label: "Wanted a kind of component", count: 3 }],
    surfaces: ["dashboard"],
    examples: [title.toLowerCase()],
    customerNames: [],
    requesters: [
      { tenantId: "acme", userId: "u1", surfaceId: "dashboard", count: 2 },
      { tenantId: "globex", userId: "u2", surfaceId: "dashboard", count: 1 },
    ],
    firstAt: "2026-11-20T09:00:00.000Z",
    lastAt: "2026-11-26T09:00:00.000Z",
    window: { since: "2026-11-20T00:00:00.000Z", until: "2026-11-27T00:00:00.000Z" },
    ...over,
  };
}

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A fake fetch: `route(call)` returns [status, json]. */
function fakeFetch(route: (c: Call) => [number, unknown]) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url: String(url),
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const [status, json] = route(call);
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

/** A request body, typed for assertions. */
const bodyOf = <T>(c: Call | undefined): T => (c?.body ?? {}) as T;

const leaksIds = (calls: Call[]) =>
  calls.some((c) => JSON.stringify(c.body ?? "").match(/"u1"|"u2"|acme|globex/));

describe("githubIssuesSink", () => {
  const map = followUp("Add a map");
  const excel = followUp("Export to Excel");

  function github(existing: Record<string, unknown>[] = []) {
    return fakeFetch((c) => {
      if (c.method === "GET") return [200, existing];
      if (c.url.endsWith("/comments")) return [201, { id: 1 }];
      return [
        201,
        {
          number: 42,
          html_url: "https://github.com/o/r/issues/42",
          title: "t",
          body: "",
          state: "open",
        },
      ];
    });
  }

  it("creates new issues with the marker and comments on existing ones", async () => {
    const gh = github([
      {
        number: 7,
        html_url: "https://github.com/o/r/issues/7",
        title: "Customer request: Add a map",
        body: `x patina-followup:${map.key}`,
        state: "open",
      },
      {
        number: 8,
        html_url: "u",
        title: "PR",
        body: `patina-followup:${excel.key}`,
        state: "open",
        pull_request: {},
      },
    ]);
    const sink = githubIssuesSink({ token: "ghp_x", repo: "o/r", appName: "Vetpal", fetch: gh.fn });
    expect(await sink.known?.()).toEqual([{ key: map.key, title: "Add a map" }]);
    const out = await sink.deliver([map, excel], []);
    expect(out.map((d) => [d.action, d.ref])).toEqual([
      ["updated", "#7"],
      ["created", "#42"],
    ]);
    expect(gh.calls[0]?.url).toBe(
      "https://api.github.com/repos/o/r/issues?labels=patina-followup&state=all&per_page=100&page=1",
    );
    expect(gh.calls[0]?.headers).toMatchObject({
      authorization: "Bearer ghp_x",
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "patina-ui",
    });
    const comment = gh.calls.find((c) => c.url.endsWith("/issues/7/comments"));
    expect(bodyOf<{ body: string }>(comment).body).toMatch(/^Asked for again: 3× by 2 customers/);
    const create = gh.calls.find((c) => c.method === "POST" && c.url.endsWith("/repos/o/r/issues"));
    expect(create?.body).toEqual({
      title: "Customer request: Export to Excel",
      body: renderFollowUpMarkdown(excel, { appName: "Vetpal" }),
      labels: ["patina-followup"],
    });
    expect(leaksIds(gh.calls)).toBe(false);
  });

  it("skips closed issues when asked, and leaves not-planned ones out of known()", async () => {
    const gh = github([
      {
        number: 7,
        html_url: "u7",
        title: "Add a map",
        body: `patina-followup:${map.key}`,
        state: "closed",
        state_reason: "not_planned",
      },
    ]);
    const sink = githubIssuesSink({ token: "t", repo: "o/r", onClosed: "skip", fetch: gh.fn });
    expect(await sink.known?.()).toEqual([]);
    const out = await sink.deliver([map], []);
    expect(out).toMatchObject([
      { action: "skipped", ref: "#7", note: "issue is closed as not planned" },
    ]);
    expect(gh.calls.filter((c) => c.method === "POST")).toEqual([]);
  });

  it("says when a completed issue is asked for again", async () => {
    const gh = github([
      {
        number: 7,
        html_url: "u7",
        title: "Add a map",
        body: `patina-followup:${map.key}`,
        state: "closed",
        state_reason: "completed",
      },
    ]);
    await githubIssuesSink({ token: "t", repo: "o/r", fetch: gh.fn }).deliver([map], []);
    const comment = gh.calls.find((c) => c.url.endsWith("/comments"));
    expect(bodyOf<{ body: string }>(comment).body).toMatch(
      /^Still asked for after this issue was completed/,
    );
  });

  it("pages through issues and reports API errors", async () => {
    let page = 0;
    const paged = fakeFetch((c) => {
      if (c.method !== "GET") return [201, { number: 1, html_url: "u" }];
      page++;
      return [
        200,
        page === 1
          ? Array.from({ length: 100 }, (_, i) => ({
              number: i,
              html_url: "u",
              title: "t",
              body: null,
              state: "open",
            }))
          : [],
      ];
    });
    await githubIssuesSink({ token: "t", repo: "o/r", fetch: paged.fn }).known?.();
    expect(paged.calls.map((c) => c.url.at(-1))).toEqual(["1", "2"]);

    const denied = fakeFetch(() => [
      403,
      { message: "Resource not accessible by personal access token" },
    ]);
    await expect(
      githubIssuesSink({ token: "t", repo: "o/r", fetch: denied.fn }).deliver([map], []),
    ).rejects.toThrow("GitHub API 403: Resource not accessible by personal access token");
    expect(() => githubIssuesSink({ token: "t", repo: "not a repo" })).toThrow(/owner\/name/);
  });
});

describe("jiraSink", () => {
  const map = followUp("Add a map");
  const excel = followUp("Export to Excel");

  function jira(issues: Record<string, unknown>[] = []) {
    return fakeFetch((c) => {
      if (c.url.endsWith("/search/jql")) return [200, { issues, isLast: true }];
      if (c.url.endsWith("/comment")) return [201, { id: "1" }];
      return [201, { key: "VP-12" }];
    });
  }

  it("finds issues by their key label, comments on them, and creates the others", async () => {
    const j = jira([
      {
        key: "VP-3",
        fields: {
          summary: "Customer request: Add a map",
          labels: ["patina-followup", map.key],
          status: { statusCategory: { key: "indeterminate" } },
        },
      },
    ]);
    const sink = jiraSink({
      baseUrl: "https://vp.atlassian.net/",
      email: "a@b.c",
      apiToken: "tok",
      projectKey: "VP",
      fetch: j.fn,
    });
    expect(await sink.known?.()).toEqual([{ key: map.key, title: "Add a map" }]);
    const out = await sink.deliver([map, excel], []);
    expect(out).toMatchObject([
      { action: "updated", ref: "VP-3", url: "https://vp.atlassian.net/browse/VP-3" },
      { action: "created", ref: "VP-12", url: "https://vp.atlassian.net/browse/VP-12" },
    ]);
    const search = j.calls[0];
    expect(search?.headers.authorization).toBe(
      `Basic ${Buffer.from("a@b.c:tok").toString("base64")}`,
    );
    expect(search?.body).toEqual({
      jql: 'project = "VP" AND labels = "patina-followup"',
      fields: ["summary", "labels", "status"],
      maxResults: 100,
    });
    const create = j.calls.find((c) => c.url.endsWith("/rest/api/3/issue"));
    const fields = bodyOf<{ fields: Record<string, unknown> }>(create).fields;
    expect(fields).toMatchObject({
      project: { key: "VP" },
      issuetype: { name: "Task" },
      summary: "Customer request: Export to Excel",
      labels: ["patina-followup", excel.key],
    });
    expect((fields.description as { type: string }).type).toBe("doc");
    expect(j.calls.some((c) => c.url.endsWith("/issue/VP-3/comment"))).toBe(true);
    expect(leaksIds(j.calls)).toBe(false);
  });

  it("skips done issues when asked, follows nextPageToken, and reports errors", async () => {
    const done = {
      key: "VP-3",
      fields: {
        summary: "x",
        labels: [map.key],
        status: { name: "Done", statusCategory: { key: "done" } },
      },
    };
    let n = 0;
    const j = fakeFetch((c) => {
      if (c.url.endsWith("/search/jql")) {
        n++;
        return [
          200,
          n === 1 ? { issues: [], nextPageToken: "p2" } : { issues: [done], isLast: true },
        ];
      }
      return [201, {}];
    });
    const sink = jiraSink({
      baseUrl: "https://vp.atlassian.net",
      email: "e",
      apiToken: "t",
      projectKey: "VP",
      onClosed: "skip",
      fetch: j.fn,
    });
    expect(await sink.deliver([map], [])).toMatchObject([
      { action: "skipped", ref: "VP-3", note: "issue is Done" },
    ]);
    expect(bodyOf<{ nextPageToken: string }>(j.calls[1]).nextPageToken).toBe("p2");

    const bad = fakeFetch(() => [
      400,
      { errorMessages: ["The value 'XX' does not exist for the field 'project'."], errors: {} },
    ]);
    await expect(
      jiraSink({
        baseUrl: "https://vp.atlassian.net",
        email: "e",
        apiToken: "t",
        projectKey: "XX",
        fetch: bad.fn,
      }).deliver([map], []),
    ).rejects.toThrow("Jira API 400: The value 'XX' does not exist");
  });
});

describe("markdownToAdf", () => {
  it("turns the follow-up markdown into paragraphs, quotes, lists and marks", () => {
    const f = followUp("Add a map", { examples: ["add a <b>map</b>"] });
    const doc = markdownToAdf(renderFollowUpMarkdown(f));
    const text = JSON.stringify(doc);
    expect(doc.type).toBe("doc");
    expect(doc.content.map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "blockquote",
      "paragraph",
      "bulletList",
      "paragraph",
      "paragraph",
    ]);
    expect(text).toContain(
      '{"type":"text","text":"Asked 3 times by 2 customers (3 users)","marks":[{"type":"strong"}]}',
    );
    expect(text).toContain('{"type":"text","text":"dashboard","marks":[{"type":"code"}]}');
    // Tags are removed (the example's and the <sub> wrapper); the marker text stays.
    expect(text).not.toMatch(/<\/?(b|sub)>/);
    expect(text).toContain(`patina-followup:${f.key}`);
  });
});

describe("perCustomerSink and hubspotSink", () => {
  const map = followUp("Add a map");
  const excel = followUp("Export <Excel> & more", {
    examples: ['export "all" <script>'],
    requesters: [{ tenantId: "acme", userId: "u1", surfaceId: "dashboard", count: 4 }],
  });

  it("calls notify once per customer with what that customer asked for", async () => {
    const seen: [string, string[]][] = [];
    const sink = perCustomerSink({
      name: "crm",
      notify: async (tenantId, fs) => {
        seen.push([tenantId, fs.map((f) => f.title)]);
        return tenantId === "globex" ? false : { ref: `crm-${tenantId}` };
      },
    });
    const nullTenant = followUp("Solo", {
      requesters: [{ tenantId: null, userId: "u9", surfaceId: "d", count: 2 }],
    });
    const out = await sink.deliver([map, excel, nullTenant], []);
    expect(seen).toEqual([
      ["acme", ["Add a map", "Export <Excel> & more"]],
      ["globex", ["Add a map"]],
    ]);
    expect(out).toEqual([
      { sink: "crm", key: map.key, action: "posted", ref: "crm-acme", note: "customer" },
      { sink: "crm", key: excel.key, action: "posted", ref: "crm-acme", note: "customer" },
    ]);
  });

  it("escapes the note HTML and counts only that customer's requests", () => {
    const body = renderCustomerNoteHtml("acme", [map, excel], { appName: "Vet<pal>" });
    expect(body).toContain("in Vet&lt;pal&gt;");
    expect(body).toContain("<strong>Add a map</strong> (2×)");
    expect(body).toContain("<strong>Export &lt;Excel&gt; &amp; more</strong> (4×)");
    expect(body).toContain("&quot;all&quot; &lt;script&gt;");
    expect(body).not.toContain("<script>");
  });

  it("adds a note to each mapped company and skips customers without one", async () => {
    const hs = fakeFetch(() => [201, { id: "n1" }]);
    const sink = hubspotSink({
      token: "pat-x",
      companyId: (t) => (t === "acme" ? "9001" : null),
      fetch: hs.fn,
    });
    const out = await sink.deliver([map, excel], []);
    expect(out.map((d) => [d.key, d.ref])).toEqual([
      [map.key, "note n1"],
      [excel.key, "note n1"],
    ]);
    expect(hs.calls).toHaveLength(1);
    expect(hs.calls[0]?.url).toBe("https://api.hubapi.com/crm/v3/objects/notes");
    expect(hs.calls[0]?.headers.authorization).toBe("Bearer pat-x");
    expect(hs.calls[0]?.body).toMatchObject({
      properties: { hs_note_body: renderCustomerNoteHtml("acme", [map, excel]) },
      associations: [
        {
          to: { id: "9001" },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 }],
        },
      ],
    });
    expect(
      Date.parse(
        bodyOf<{ properties: { hs_timestamp: string } }>(hs.calls[0]).properties.hs_timestamp,
      ),
    ).not.toBeNaN();

    const denied = fakeFetch(() => [401, { message: "Authentication credentials not found." }]);
    await expect(
      hubspotSink({ token: "x", companyId: () => "1", fetch: denied.fn }).deliver([map], []),
    ).rejects.toThrow("HubSpot API 401: Authentication credentials not found.");
  });
});
