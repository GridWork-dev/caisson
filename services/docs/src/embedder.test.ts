import { describe, expect, test } from "bun:test";
import { FAKE_EMBED_DIM, FakeEmbedder } from "./embedder.ts";

describe("FakeEmbedder", () => {
  test("is deterministic — same text yields the identical vector", async () => {
    const e = new FakeEmbedder();
    const a = await e.embed("billing webhook hmac verify");
    const b = await e.embed("billing webhook hmac verify");
    expect(b).toEqual(a);
  });

  test("produces the configured dimension, L2-normalized", async () => {
    const e = new FakeEmbedder();
    const v = await e.embed("compliance worm hash chain");
    expect(v.length).toBe(FAKE_EMBED_DIM);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  test("differing texts produce differing vectors", async () => {
    const e = new FakeEmbedder();
    const a = await e.embed("billing webhook hmac");
    const b = await e.embed("local first sqlite vector store");
    expect(b).not.toEqual(a);
  });

  test("empty/symbol-only text yields an in-bounds zero vector (never throws)", async () => {
    const e = new FakeEmbedder();
    const z = await e.embed("   --- ");
    expect(z.length).toBe(FAKE_EMBED_DIM);
    expect(z.every((x) => x === 0)).toBe(true);
  });

  test("honors a custom dimension", async () => {
    const v = await new FakeEmbedder(16).embed("kernel credits ledger");
    expect(v.length).toBe(16);
  });
});
