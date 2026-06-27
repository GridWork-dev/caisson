// Unit tests for the hybrid store (ADR-0067). In-process, deterministic, no network: the FTS5 floor
// is always available; the vec leg degrades when absent/failed; a dimension mismatch throws. The
// golden RRF ranking itself is asserted in golden.test.ts.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { LocalStore } from "./store.ts";

/** Same corpus as the golden, minus the FTS-absent `canine` vec-only doc where noted. */
function seed(store: LocalStore): void {
  store.upsert({ id: "fox", text: "fox", embedding: [1, 0, 0] });
  store.upsert({
    id: "fox-quick",
    text: "fox fox fox quick",
    embedding: [0, 1, 0],
  });
  store.upsert({
    id: "canine",
    text: "canine animal companion",
    embedding: [0.95, 0.05, 0],
  });
}

describe("LocalStore hybrid retrieval (ADR-0067)", () => {
  test("degrades to FTS5-only when no query vector is supplied", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      const hits = store.hybridSearch({ queryText: "fox" }); // no queryVector ⇒ vec leg skipped
      const ids = hits.map((h) => h.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("fox");
      expect(ids).toContain("fox-quick");
      // `canine` has a strong vector but NO "fox" FTS hit → absent once the vec leg is gone.
      expect(ids).not.toContain("canine");
    } finally {
      store.close();
    }
  });

  test("the FTS5 floor is available for docs indexed without an embedding", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      store.upsert({ id: "no-vec", text: "keyword only document" }); // no embedding at all
      const hits = store.hybridSearch({
        queryText: "keyword",
        queryVector: [0, 0, 0],
      });
      expect(hits.map((h) => h.id)).toEqual(["no-vec"]);
    } finally {
      store.close();
    }
  });

  test("a vec-only doc surfaces via the hybrid leg but not via FTS-only", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      const hybrid = store
        .hybridSearch({ queryText: "fox", queryVector: [1, 0, 0] })
        .map((h) => h.id);
      const ftsOnly = store.hybridSearch({ queryText: "fox" }).map((h) => h.id);
      expect(hybrid).toContain("canine"); // vec leg pulls it in
      expect(ftsOnly).not.toContain("canine"); // FTS-only cannot
    } finally {
      store.close();
    }
  });

  test("a mismatched embedding dimension throws on upsert (flag-never-guess)", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      expect(() =>
        store.upsert({ id: "bad", text: "x", embedding: [1, 0] }),
      ).toThrow(ValidationError);
    } finally {
      store.close();
    }
  });

  test("a mismatched query-vector dimension throws on search", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      expect(() =>
        store.hybridSearch({ queryText: "fox", queryVector: [1, 0] }),
      ).toThrow(ValidationError);
    } finally {
      store.close();
    }
  });

  test("a non-positive dim is rejected at open", () => {
    expect(() => LocalStore.open({ dim: 0 })).toThrow(ValidationError);
  });
});
