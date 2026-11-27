import { describe, expect, it, vi } from "vitest";
import { createFetchSource } from "../src/index.js";

const signal = new AbortController().signal;
// Friday 2026-11-27, 15:30 local time.
const now = () => new Date(2026, 10, 27, 15, 30);

function server(handler: (url: URL) => unknown) {
  const calls: URL[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://app.test");
    calls.push(url);
    expect(init?.signal).toBe(signal);
    return new Response(JSON.stringify(handler(url)));
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("createFetchSource", () => {
  it("adds tenant params, fills path placeholders, and goes to another origin with credentials", async () => {
    const { fetch, calls } = server(() => ({ appointments: [{ id: 1 }] }));
    const init: RequestInit[] = [];
    const fs = createFetchSource({
      baseUrl: "https://api.test/",
      credentials: "include",
      params: { accountId: "acc 1" },
      sources: { appointments: { rows: "appointments" } },
      fetch: ((i: RequestInfo, o?: RequestInit) => {
        init.push(o ?? {});
        return fetch(i, o);
      }) as typeof globalThis.fetch,
    });
    const rows = await fs({
      source: "appointments",
      path: "/api/accounts/:accountId/appointments",
      params: { status: "booked" },
      signal,
    });
    expect(rows).toEqual([{ id: 1 }]);
    expect(calls[0]?.href).toBe("https://api.test/api/accounts/acc%201/appointments?status=booked");
    expect(init[0]?.credentials).toBe("include");
  });

  it("pages by offset until a short page or the total, one page at a time", async () => {
    const data = Array.from({ length: 450 }, (_, i) => ({ id: i }));
    const { fetch, calls } = server((u) => {
      const limit = Number(u.searchParams.get("limit"));
      const offset = Number(u.searchParams.get("offset"));
      return { items: data.slice(offset, offset + limit), total: data.length };
    });
    const fs = createFetchSource({
      rows: "items",
      paging: { style: "offset", size: 200, total: "total" },
      fetch,
    });
    const rows = (await fs({
      source: "calls",
      path: "/api/calls",
      params: {},
      signal,
    })) as unknown[];
    expect(rows).toHaveLength(450);
    expect(calls.map((c) => c.searchParams.get("offset"))).toEqual(["0", "200", "400"]);
  });

  it("pages by page number and by cursor", async () => {
    const byPage = server((u) => {
      const p = Number(u.searchParams.get("page"));
      return p < 3 ? [{ p }, { p }] : [{ p }];
    });
    const pages = createFetchSource({ paging: { style: "page", size: 2 }, fetch: byPage.fetch });
    expect(await pages({ source: "s", path: "/s", params: {}, signal })).toHaveLength(5);

    const byCursor = server((u) => {
      const c = u.searchParams.get("cursor");
      return c === "b"
        ? { data: [{ id: 3 }], meta: { next: null } }
        : { data: [{ id: c ?? "1" }], meta: { next: c ? "b" : "a" } };
    });
    const cursor = createFetchSource({
      rows: "data",
      paging: { style: "cursor", next: "meta.next" },
      fetch: byCursor.fetch,
    });
    expect(await cursor({ source: "s", path: "/s", params: {}, signal })).toEqual([
      { id: "1" },
      { id: "a" },
      { id: 3 },
    ]);
  });

  it("stops at maxPages instead of looping forever", async () => {
    const { fetch } = server(() => ({ data: [{}], meta: { next: "again" } }));
    const fs = createFetchSource({
      rows: "data",
      paging: { style: "cursor", next: "meta.next" },
      maxPages: 3,
      fetch,
    });
    await expect(fs({ source: "s", path: "/s", params: {}, signal })).rejects.toThrow(
      "Stopped after 3 pages",
    );
  });

  it.each([
    [
      "thisWeek",
      "iso",
      new Date(2026, 10, 23).toISOString(),
      new Date(new Date(2026, 10, 28).getTime() - 1).toISOString(),
    ],
    ["last7days", "date", "2026-11-20", "2026-11-27"],
    ["lastMonth", "date", "2026-10-01", "2026-10-31"],
  ] as const)(
    "turns the range %j into the endpoint's own dates (%s)",
    async (range, format, from, to) => {
      const { fetch, calls } = server(() => []);
      const fs = createFetchSource({ dateRange: { from: "start", to: "end", format }, fetch, now });
      await fs({ source: "s", path: "/s", params: { range }, signal });
      expect(calls[0]?.searchParams.get("range")).toBeNull();
      expect(calls[0]?.searchParams.get("start")).toBe(from);
      expect(calls[0]?.searchParams.get("end")).toBe(to);
    },
  );

  it("leaves a range it doesn't know as a plain param", async () => {
    const { fetch, calls } = server(() => []);
    const fs = createFetchSource({ dateRange: { from: "start", to: "end" }, fetch, now });
    await fs({ source: "s", path: "/s", params: { range: "fiscalQ3" }, signal });
    expect(calls[0]?.searchParams.get("range")).toBe("fiscalQ3");
  });

  it("says what's wrong instead of returning nothing", async () => {
    const { fetch } = server(() => ({ results: [] }));
    await expect(
      createFetchSource({ rows: "items", fetch })({ source: "s", path: "/s", params: {}, signal }),
    ).rejects.toThrow('Couldn\'t find rows at "items"');
    await expect(
      createFetchSource({ fetch })({ source: "s", path: "/a/:tenantId/b", params: {}, signal }),
    ).rejects.toThrow('No value for ":tenantId"');
  });
});
