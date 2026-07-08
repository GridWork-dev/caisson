import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Embedder } from "@caisson/local-store";
import { CachedEmbedder, cacheKey } from "./embed-cache.ts";

const MODEL = "test/embed-model";
const DIM = 4;

/** Deterministic fake inner embedder that counts real calls. */
function countingEmbedder(): Embedder & { calls: number } {
  const fake = {
    dim: DIM,
    calls: 0,
    embed(text: string): Promise<number[]> {
      fake.calls++;
      return Promise.resolve([text.length, 1, 2, 3]);
    },
  };
  return fake;
}

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "embed-cache-"));
  path = join(dir, "nested", "embed-cache.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("CachedEmbedder", () => {
  test("miss delegates, save + reload turns it into a hit with no inner call", async () => {
    const first = countingEmbedder();
    const cached = new CachedEmbedder(first, path, MODEL);
    const v1 = await cached.embed("alpha");
    const v2 = await cached.embed("beta");
    expect(first.calls).toBe(2);
    expect(cached.misses).toBe(2);
    cached.save();

    const second = countingEmbedder();
    const warm = new CachedEmbedder(second, path, MODEL);
    expect(warm.size).toBe(2);
    expect(await warm.embed("alpha")).toEqual(v1);
    expect(await warm.embed("beta")).toEqual(v2);
    expect(second.calls).toBe(0);
    expect(warm.hits).toBe(2);
  });

  test("repeat embed within one process hits in-memory without a second inner call", async () => {
    const inner = countingEmbedder();
    const cached = new CachedEmbedder(inner, path, MODEL);
    await cached.embed("alpha");
    await cached.embed("alpha");
    expect(inner.calls).toBe(1);
    expect(cached.hits).toBe(1);
  });

  test("model drift invalidates the whole cache", async () => {
    const cached = new CachedEmbedder(countingEmbedder(), path, MODEL);
    await cached.embed("alpha");
    cached.save();

    const drifted = new CachedEmbedder(countingEmbedder(), path, "other/model");
    expect(drifted.size).toBe(0);
  });

  test("corrupt cache file is a cold start, not a throw", async () => {
    const cached = new CachedEmbedder(countingEmbedder(), path, MODEL);
    await cached.embed("alpha");
    cached.save();
    writeFileSync(path, "{not json");

    const cold = new CachedEmbedder(countingEmbedder(), path, MODEL);
    expect(cold.size).toBe(0);
  });

  test("wrong-width entry is dropped on load instead of poisoning the index", async () => {
    const cached = new CachedEmbedder(countingEmbedder(), path, MODEL);
    await cached.embed("alpha");
    cached.save();
    const file = JSON.parse(readFileSync(path, "utf8")) as {
      entries: Record<string, number[]>;
    };
    file.entries[cacheKey("beta")] = [1, 2]; // width 2 ≠ dim 4
    writeFileSync(path, JSON.stringify({ ...file }));

    const warm = new CachedEmbedder(countingEmbedder(), path, MODEL);
    expect(warm.size).toBe(1); // alpha kept, beta dropped
  });

  test("save without new entries is a no-op; save failure is swallowed", async () => {
    const inner = countingEmbedder();
    const cached = new CachedEmbedder(inner, path, MODEL);
    cached.save(); // nothing dirty — must not create the file
    expect(() => readFileSync(path, "utf8")).toThrow();

    writeFileSync(join(dir, "blocker"), "x"); // the cache dir path is occupied by a FILE
    const impossible = new CachedEmbedder(
      inner,
      join(dir, "blocker", "cache.json"),
      MODEL,
    );
    await impossible.embed("alpha");
    expect(() => {
      impossible.save();
    }).not.toThrow();
  });
});
