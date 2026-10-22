import { describe, expect, it } from "vitest";
import { createAsyncCache } from "../apps/web/lib/async-cache";

describe("bounded query cache", () => {
  it("shares concurrent work and keeps different versions isolated", async () => {
    const cache = createAsyncCache<string>(2);
    let calls = 0;
    const load = async () => { calls++; return "current"; };
    const first = cache.get("published:current", load);
    expect(cache.get("published:current", load)).toBe(first);
    expect(await cache.get("preview:current", async () => "preview")).toBe("preview");
    expect(await first).toBe("current");
    expect(calls).toBe(1);
  });
  it("retries failures and evicts the least recently read version", async () => {
    const cache = createAsyncCache<number>(2);
    await expect(cache.get("broken", async () => { throw new Error("read failed"); })).rejects.toThrow("read failed");
    expect(await cache.get("broken", async () => 1)).toBe(1);
    await cache.get("b", async () => 2);
    await cache.get("broken", async () => 99);
    await cache.get("c", async () => 3);
    expect(cache.size).toBe(2);
    expect(await cache.get("b", async () => 4)).toBe(4);
  });
  it("an evicted rejected load cannot discard a newer load for the same key", async () => {
    const cache = createAsyncCache<number>(1);
    let fail!: (error: Error) => void;
    const old = cache.get("a", () => new Promise((_, reject) => { fail = reject; }));
    await Promise.resolve();
    await cache.get("b", async () => 2);
    const newer = cache.get("a", async () => 3);
    fail(new Error("old"));
    await expect(old).rejects.toThrow("old");
    expect(cache.get("a", async () => 4)).toBe(newer);
    expect(await newer).toBe(3);
  });
});
