// Unit tests for the InferenceBackend port + its deterministic CI stub (ADR-0064: no live model in
// CI). In-process, deterministic, NO network, NO model: the stub embeds purely from text and the
// integration leg proves the produced vector feeds @caisson-sh/local-store's vec0 dim-guard without a
// dimension mismatch — i.e. the port emits exactly the locked DIM the store is opened with.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ValidationError } from "@caisson-sh/kernel";
import { LocalStore } from "@caisson-sh/local-store";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { EMBEDDING_DIM } from "./backend.ts";
import { StubInferenceBackend } from "./stub.ts";

const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const STUB_ENTRY = join(import.meta.dir, "stub.ts");

describe("StubInferenceBackend browser contract", () => {
  test("its runtime graph reaches no node builtin", () => {
    const walk = nodeBuiltinTaint(STUB_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(walk.unresolved).toEqual([]);
    expect(walk.offenders).toEqual([]);
  });

  test("the WebCrypto swap preserves the existing deterministic golden", async () => {
    const stub = new StubInferenceBackend({ dim: 8 });
    expect(Array.from(await stub.embed("offline-first"))).toEqual([
      0.13572371006011963, 0.40440019965171814, -0.6178563833236694,
      -0.30705133080482483, -0.25519251823425293, -0.04712666571140289,
      0.3809182941913605, -0.3599577844142914,
    ]);
    expect(await stub.complete({ prompt: "summarize this" })).toEqual({
      text: "stub:de6da4a2 summarize this",
      model: "caisson-stub-embed",
    });
  });
});

describe("StubInferenceBackend.embed (ADR-0064 deterministic CI stub)", () => {
  test("emits a Float32Array of exactly the locked DIM", async () => {
    const stub = new StubInferenceBackend();
    expect(stub.dim).toBe(EMBEDDING_DIM);
    const vec = await stub.embed("the quick brown fox");
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(EMBEDDING_DIM);
  });

  test("is deterministic — identical text yields the byte-identical vector", async () => {
    const stub = new StubInferenceBackend();
    const a = await stub.embed("offline-first");
    const b = await stub.embed("offline-first");
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test("distinct text yields a distinct vector", async () => {
    const stub = new StubInferenceBackend();
    const a = await stub.embed("alpha");
    const b = await stub.embed("beta");
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  test("every component is finite and the vector is unit-normalized", async () => {
    const stub = new StubInferenceBackend();
    const vec = await stub.embed("normalization check");
    let sumSq = 0;
    for (const v of vec) {
      expect(Number.isFinite(v)).toBe(true);
      sumSq += v * v;
    }
    expect(sumSq).toBeGreaterThan(0.99);
    expect(sumSq).toBeLessThan(1.01);
  });

  test("an injected dim is honored (focused tests use a small width)", async () => {
    const stub = new StubInferenceBackend({ dim: 8 });
    expect(stub.dim).toBe(8);
    const vec = await stub.embed("small");
    expect(vec.length).toBe(8);
  });

  test("a non-positive / non-integer dim fails closed at construction", () => {
    expect(() => new StubInferenceBackend({ dim: 0 })).toThrow(ValidationError);
    expect(() => new StubInferenceBackend({ dim: -4 })).toThrow(
      ValidationError,
    );
    expect(() => new StubInferenceBackend({ dim: 3.5 })).toThrow(
      ValidationError,
    );
  });
});

describe("StubInferenceBackend.complete (offline generation seam)", () => {
  test("is deterministic and labels the producing model", async () => {
    const stub = new StubInferenceBackend();
    const a = await stub.complete({ prompt: "summarize this" });
    const b = await stub.complete({ prompt: "summarize this" });
    expect(a).toEqual(b);
    expect(a.model).toBe("caisson-stub-embed");
    expect(a.text.length).toBeGreaterThan(0);
  });

  test("respects the maxTokens soft bound", async () => {
    const stub = new StubInferenceBackend();
    const out = await stub.complete({
      prompt: "a very long prompt",
      maxTokens: 5,
    });
    expect(out.text.length).toBeLessThanOrEqual(5);
  });
});

describe("port ↔ local-store dim-guard (the seam local-store expects injected)", () => {
  test("embeddings feed vec0 without a dimension mismatch and retrieve hybrid", async () => {
    const stub = new StubInferenceBackend();
    const store = LocalStore.open({ dim: stub.dim });
    try {
      const text = "the quick brown fox jumps over the lazy dog";
      const docVec = await stub.embed(text);
      // No throw here proves the port emits exactly the locked DIM the vec0 table was opened with.
      store.upsert({ id: "doc-1", text, embedding: Array.from(docVec) });

      const queryVec = await stub.embed(text);
      const hits = store.hybridSearch({
        queryText: "fox",
        queryVector: Array.from(queryVec),
      });
      expect(hits.map((h) => h.id)).toContain("doc-1");
    } finally {
      store.close();
    }
  });
});
