// Pre-call MinHash/LSH dedup-before-meter gate (ADR-0211). Pure hashing core + in-memory store +
// checkDedupGate — no DB, no network, no wallet movement.
import { describe, expect, test } from "bun:test";
import type { EstimateMessage } from "./estimate.ts";
import {
  checkDedupGate,
  computeMinHashSignature,
  createInMemoryDedupStore,
  jaccardEstimate,
  lshBands,
  normalizePrompt,
  shingle,
} from "./dedup.ts";

function msgs(content: string): EstimateMessage[] {
  return [{ role: "user", content }];
}

describe("normalizePrompt", () => {
  test("lowercases and collapses whitespace across messages", () => {
    expect(
      normalizePrompt([
        { role: "user", content: "  Hello   World  " },
        { role: "user", content: "FOO" },
      ]),
    ).toBe("hello world foo");
  });
});

describe("shingle", () => {
  test("k-word sliding shingles", () => {
    expect(shingle("the quick brown fox jumps", 3)).toEqual([
      "the quick brown",
      "quick brown fox",
      "brown fox jumps",
    ]);
  });

  test("shorter-than-k text collapses to one shingle", () => {
    expect(shingle("hi there", 3)).toEqual(["hi there"]);
  });

  test("empty text has no shingles", () => {
    expect(shingle("", 3)).toEqual([]);
  });
});

describe("computeMinHashSignature + jaccardEstimate", () => {
  test("identical shingle sets produce identical signatures (similarity 1)", () => {
    const s = shingle(normalizePrompt(msgs("the quick brown fox jumps over")));
    const a = computeMinHashSignature(s, 32);
    const b = computeMinHashSignature(s, 32);
    expect(jaccardEstimate(a, b)).toBe(1);
  });

  test("is deterministic across calls (same fixed permutation coefficients)", () => {
    const s = shingle(normalizePrompt(msgs("deterministic hashing test text")));
    expect(Array.from(computeMinHashSignature(s, 16))).toEqual(
      Array.from(computeMinHashSignature(s, 16)),
    );
  });

  test("unrelated texts land well under a conservative threshold", () => {
    const a = computeMinHashSignature(
      shingle(
        normalizePrompt(
          msgs("summarize the quarterly earnings report for acme corp"),
        ),
      ),
      32,
    );
    const b = computeMinHashSignature(
      shingle(
        normalizePrompt(msgs("write a haiku about a rainy afternoon in kyoto")),
      ),
      32,
    );
    expect(jaccardEstimate(a, b)).toBeLessThan(0.92);
  });

  test("near-identical (whitespace/case variant) scores at/near 1", () => {
    const a = computeMinHashSignature(
      shingle(
        normalizePrompt(
          msgs("Summarize the quarterly earnings report for Acme Corp"),
        ),
      ),
      32,
    );
    const b = computeMinHashSignature(
      shingle(
        normalizePrompt(
          msgs("  summarize   the quarterly earnings report for acme corp  "),
        ),
      ),
      32,
    );
    expect(jaccardEstimate(a, b)).toBeGreaterThanOrEqual(0.92);
  });

  test("mismatched-length signatures compare as 0", () => {
    const a = computeMinHashSignature(["x"], 8);
    const b = computeMinHashSignature(["x"], 16);
    expect(jaccardEstimate(a, b)).toBe(0);
  });
});

describe("lshBands", () => {
  test("bands*rows must equal the signature length", () => {
    const sig = computeMinHashSignature(["a", "b"], 32);
    expect(() => lshBands(sig, 16, 3)).toThrow();
  });

  test("produces one key per band, stable for equal signatures", () => {
    const sig = computeMinHashSignature(["a", "b", "c"], 32);
    const keys = lshBands(sig, 16, 2);
    expect(keys).toHaveLength(16);
    expect(lshBands(sig, 16, 2)).toEqual(keys);
  });
});

describe("createInMemoryDedupStore", () => {
  test("insert then candidates hits by shared band key", async () => {
    const store = createInMemoryDedupStore(10);
    const sig = computeMinHashSignature(["shared", "shingle", "set"], 32);
    const bucketKeys = lshBands(sig, 16, 2);
    await store.insert("acct_1", "account", bucketKeys, {
      callId: "call_1",
      signature: sig,
      at: new Date(),
    });
    const hits = await store.candidates("acct_1", "account", bucketKeys);
    expect(hits.map((h) => h.callId)).toEqual(["call_1"]);
  });

  test("candidates on an unseen account/scope is empty", async () => {
    const store = createInMemoryDedupStore(10);
    expect(await store.candidates("acct_none", "account", ["0:1,2"])).toEqual(
      [],
    );
  });

  test("capacity eviction drops the oldest entry", async () => {
    const store = createInMemoryDedupStore(2);
    const bucketKeys = ["0:1,2"];
    for (const callId of ["call_1", "call_2", "call_3"]) {
      await store.insert("acct_1", "account", bucketKeys, {
        callId,
        signature: new Uint32Array(1),
        at: new Date(),
      });
    }
    const hits = await store.candidates("acct_1", "account", bucketKeys);
    expect(hits.map((h) => h.callId)).toEqual(["call_2", "call_3"]);
  });

  test("scopes are isolated — a different scope never sees another scope's entries", async () => {
    const store = createInMemoryDedupStore(10);
    const bucketKeys = ["0:1,2"];
    await store.insert("acct_1", "account", bucketKeys, {
      callId: "call_1",
      signature: new Uint32Array(1),
      at: new Date(),
    });
    expect(await store.candidates("acct_1", "project", bucketKeys)).toEqual([]);
  });
});

describe("checkDedupGate", () => {
  test("first call always proceeds", async () => {
    const store = createInMemoryDedupStore();
    const result = await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_1",
        messages: msgs("summarize the quarterly earnings report for acme corp"),
      },
      { store },
    );
    expect(result.kind).toBe("proceed");
  });

  test("a near-identical paraphrase/whitespace variant flags duplicate-of the prior callId", async () => {
    const store = createInMemoryDedupStore();
    await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_1",
        messages: msgs("Summarize the quarterly earnings report for Acme Corp"),
      },
      { store },
    );
    const result = await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_2",
        messages: msgs(
          "  summarize   the quarterly earnings report for acme corp  ",
        ),
      },
      { store },
    );
    expect(result.kind).toBe("duplicate-of");
    if (result.kind === "duplicate-of") {
      expect(result.callId).toBe("call_1");
      expect(result.similarity).toBeGreaterThanOrEqual(0.92);
    }
  });

  test("an unrelated prompt proceeds even with prior calls in the store", async () => {
    const store = createInMemoryDedupStore();
    await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_1",
        messages: msgs("summarize the quarterly earnings report for acme corp"),
      },
      { store },
    );
    const result = await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_2",
        messages: msgs("write a haiku about a rainy afternoon in kyoto"),
      },
      { store },
    );
    expect(result.kind).toBe("proceed");
  });

  test("a call never matches its own just-inserted signature (insert happens after match)", async () => {
    const store = createInMemoryDedupStore();
    const result = await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_1",
        messages: msgs("this exact same prompt text"),
      },
      { store },
    );
    expect(result.kind).toBe("proceed");
    // A second, distinct call with the SAME text should now match call_1 — proving the store did
    // persist the first insert (not that matching is broken).
    const second = await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_2",
        messages: msgs("this exact same prompt text"),
      },
      { store },
    );
    expect(second.kind).toBe("duplicate-of");
  });

  test("a custom threshold above the similarity lets a near-dup through as proceed", async () => {
    const store = createInMemoryDedupStore();
    await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_1",
        messages: msgs("Summarize the quarterly earnings report for Acme Corp"),
      },
      { store },
    );
    const result = await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_2",
        messages: msgs(
          "  summarize   the quarterly earnings report for acme corp  ",
        ),
      },
      { store, threshold: 1.01 },
    );
    expect(result.kind).toBe("proceed");
  });

  test("different accountId never cross-matches", async () => {
    const store = createInMemoryDedupStore();
    await checkDedupGate(
      {
        accountId: "acct_1",
        scope: "account",
        callId: "call_1",
        messages: msgs("summarize the quarterly earnings report for acme corp"),
      },
      { store },
    );
    const result = await checkDedupGate(
      {
        accountId: "acct_2",
        scope: "account",
        callId: "call_2",
        messages: msgs("summarize the quarterly earnings report for acme corp"),
      },
      { store },
    );
    expect(result.kind).toBe("proceed");
  });

  test("rejects an unknown field at the boundary (strict schema)", async () => {
    const store = createInMemoryDedupStore();
    await expect(
      checkDedupGate(
        {
          accountId: "acct_1",
          scope: "account",
          callId: "call_1",
          messages: msgs("hi"),
          // @ts-expect-error — deliberately testing the strict-schema rejection path.
          extra: "nope",
        },
        { store },
      ),
    ).rejects.toThrow();
  });
});
