/** Creates or updates one sticky PR comment, identified by a hidden marker. */
export async function upsertPrComment(opts: {
  token: string;
  repo: string; // "owner/name"
  pr: number;
  body: string;
  marker: string;
  apiUrl?: string;
  /** Only create a new comment if this is true; an existing one is always updated. */
  createIfMissing: boolean;
  fetch?: typeof fetch;
}): Promise<"created" | "updated" | "skipped"> {
  const f = opts.fetch ?? fetch;
  const api = (opts.apiUrl ?? "https://api.github.com").replace(/\/$/, "");
  const headers = {
    authorization: `Bearer ${opts.token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
  };
  let existing: { id: number } | undefined;
  for (let page = 1; page <= 10 && !existing; page++) {
    const res = await f(
      `${api}/repos/${opts.repo}/issues/${opts.pr}/comments?per_page=100&page=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub: listing comments failed (${res.status})`);
    const comments = (await res.json()) as { id: number; body?: string }[];
    existing = comments.find((c) => c.body?.includes(opts.marker));
    if (comments.length < 100) break;
  }
  if (existing) {
    const res = await f(`${api}/repos/${opts.repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: opts.body }),
    });
    if (!res.ok) throw new Error(`GitHub: updating the comment failed (${res.status})`);
    return "updated";
  }
  if (!opts.createIfMissing) return "skipped";
  const res = await f(`${api}/repos/${opts.repo}/issues/${opts.pr}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body: opts.body }),
  });
  if (!res.ok) throw new Error(`GitHub: creating the comment failed (${res.status})`);
  return "created";
}
