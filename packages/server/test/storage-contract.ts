import { describe, expect, it } from "vitest";
import { ConflictError, type HistoryKey, type StorageAdapter } from "../src/index.js";

/** The behaviour every StorageAdapter must have. Run it against each implementation. */
export function storageContract(
  name: string,
  make: () => Promise<StorageAdapter & { redactPrompts(before: Date): Promise<number> }>,
) {
  const key: HistoryKey = { tenantId: "t1", layer: "user", subjectId: "u1", surfaceId: "s" };
  const other: HistoryKey = { ...key, subjectId: "u2" };
  const patch = (id: string) => ({
    kind: "patch" as const,
    id,
    patch: {
      id,
      schemaVersion: 1 as const,
      baseVersion: 1,
      ops: [{ op: "set" as const, node: "n", path: ["p"] as [string], value: 1 }],
      summary: "s",
    },
    prompt: "do it",
    summary: "s",
    model: "m",
  });

  describe(`${name}: storage contract`, () => {
    it("appends in order and lists per key", async () => {
      const s = await make();
      expect(await s.list(key)).toEqual([]);
      const a = await s.append(key, patch("a"), 0);
      expect(a).toMatchObject({ kind: "patch", id: "a", seq: 1, prompt: "do it", model: "m" });
      await s.append(key, { kind: "revert", id: "r", targetId: "a" }, 1);
      await s.append(key, { kind: "reset", id: "x" }, 2);
      const list = await s.list(key);
      expect(list.map((e) => [e.kind, e.seq])).toEqual([
        ["patch", 1],
        ["revert", 2],
        ["reset", 3],
      ]);
      expect(list[0]).toMatchObject({
        patch: {
          id: "a",
          schemaVersion: 1,
          baseVersion: 1,
          ops: [{ op: "set", node: "n", path: ["p"], value: 1 }],
        },
      });
      expect(list[1]).toMatchObject({ targetId: "a" });
      expect(typeof list[0]?.createdAt).toBe("string");
      expect(await s.list(other)).toEqual([]);
    });

    it("rejects appends against a stale head", async () => {
      const s = await make();
      await s.append(key, patch("a"), 0);
      await expect(s.append(key, patch("b"), 0)).rejects.toBeInstanceOf(ConflictError);
      await expect(s.append(key, patch("c"), 5)).rejects.toBeInstanceOf(ConflictError);
      const results = await Promise.allSettled([
        s.append(key, patch("d"), 1),
        s.append(key, patch("e"), 1),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await s.list(key)).map((e) => e.id)).toHaveLength(2);
    });

    it("hands out each proposal once, only to its owner, only before it expires", async () => {
      const s = await make();
      const p = {
        id: "p1",
        key,
        baseSeq: 0,
        ops: [],
        summary: "x",
        prompt: "y",
        model: "m",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      await s.saveProposal(p);
      expect(await s.takeProposal("p1", other)).toBeNull();
      expect(await s.takeProposal("p1", key)).toMatchObject({ id: "p1", baseSeq: 0, prompt: "y" });
      expect(await s.takeProposal("p1", key)).toBeNull();
      await s.saveProposal({
        ...p,
        id: "p2",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      expect(await s.takeProposal("p2", key)).toBeNull();
    });

    it("counts usage per key", async () => {
      const s = await make();
      const k = { tenantId: "t1", subjectId: "u1", period: "2026-11" };
      expect(await s.incrementUsage?.(k)).toBe(1);
      expect(await s.incrementUsage?.(k)).toBe(2);
      expect(await s.incrementUsage?.({ ...k, period: "2026-12" })).toBe(1);
      expect(await s.incrementUsage?.({ ...k, subjectId: "*" })).toBe(1);
    });

    it("redacts old prompts", async () => {
      const s = await make();
      await s.append(key, patch("a"), 0);
      expect(await s.redactPrompts(new Date(Date.now() - 60_000))).toBe(0);
      expect(await s.redactPrompts(new Date(Date.now() + 60_000))).toBe(1);
      expect((await s.list(key))[0]).toMatchObject({ prompt: null, patch: { id: "a" } });
    });
  });
}
