// Unit tests for the hybrid store (ADR-0067). In-process, deterministic, no network: the FTS5 floor
// is always available; the vec leg degrades when absent/failed; a dimension mismatch throws. The
// golden RRF ranking itself is asserted in golden.test.ts.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
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

  test("a multi-word query matches docs whose tokens are NOT adjacent (per-token OR, not one phrase)", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      store.upsert({
        id: "refunds",
        text: "every purchase can be refunded under the policy within 14 days",
      });
      store.upsert({ id: "unrelated", text: "credit wallet grant and debit" });
      // The old whole-query phrase sanitization required "refunded ... policy" adjacent in
      // order, so ANY natural-language multi-word query returned zero FTS rows.
      const ids = store
        .hybridSearch({ queryText: "what is the refunded policy?" })
        .map((h) => h.id);
      expect(ids).toContain("refunds");
      expect(ids).not.toContain("unrelated");
    } finally {
      store.close();
    }
  });

  test("FTS operators in caller text stay inert (per-token quoting)", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      // NOT/AND/parens are FTS5 operators; quoted per-token they are just literal words.
      const hits = store.hybridSearch({ queryText: 'fox NOT "quick" (AND' });
      expect(hits.map((h) => h.id)).toContain("fox");
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

  test("bulk upsert writes a queryable corpus through one transaction", () => {
    const store = LocalStore.open({ dim: 3 });
    const bulkStore = store as unknown as {
      upsertMany?: (docs: { id: string; text: string }[]) => void;
    };
    try {
      expect(typeof bulkStore.upsertMany).toBe("function");
      bulkStore.upsertMany?.([
        { id: "one", text: "artifact billing" },
        { id: "two", text: "artifact compliance" },
      ]);
      expect(
        store.hybridSearch({ queryText: "billing" }).map((hit) => hit.id),
      ).toEqual(["one"]);
    } finally {
      store.close();
    }
  });
});

describe("LocalStore.list (read-only agent-memory paging)", () => {
  test("pages documents newest-first, bounded by limit + offset", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      for (let i = 0; i < 5; i++) {
        store.upsert({ id: `doc-${i}`, text: `text ${i}` });
      }
      // DESC by insertion order — the most recently upserted doc first.
      expect(store.list().map((d) => d.id)).toEqual([
        "doc-4",
        "doc-3",
        "doc-2",
        "doc-1",
        "doc-0",
      ]);
      // A bounded page: limit 2 offset 1 skips the newest, returns the next two.
      expect(store.list({ limit: 2, offset: 1 }).map((d) => d.id)).toEqual([
        "doc-3",
        "doc-2",
      ]);
      // Text round-trips alongside the id.
      expect(store.list({ limit: 1 })[0]).toEqual({
        id: "doc-4",
        text: "text 4",
      });
    } finally {
      store.close();
    }
  });

  test("clamps an out-of-range or junk limit/offset instead of throwing", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      store.upsert({ id: "only", text: "x" });
      // A non-positive limit clamps up to 1, not 0 (never an empty page for an out-of-range ask).
      expect(store.list({ limit: 0 }).length).toBe(1);
      expect(store.list({ limit: -5 }).length).toBe(1);
      // A huge limit clamps down to LIST_MAX_LIMIT rather than scanning unbounded.
      expect(() => store.list({ limit: 10_000_000 })).not.toThrow();
      // A negative offset clamps to 0 rather than throwing.
      expect(store.list({ offset: -1 }).length).toBe(1);
      // Non-finite input falls back to the default rather than propagating NaN into SQL.
      expect(store.list({ limit: Number.NaN }).length).toBe(1);
    } finally {
      store.close();
    }
  });

  test("an empty store lists as an empty page", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      expect(store.list()).toEqual([]);
    } finally {
      store.close();
    }
  });
});

describe("ftsWeight fusion lever (CAISSON-83)", () => {
  test("default weight is byte-stable with the classic symmetric form (weight 1)", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      const query = { queryText: "fox", queryVector: [1, 0, 0] };
      const plain = store.hybridSearch(query);
      const explicit = store.hybridSearch({ ...query, ftsWeight: 1 });
      expect(explicit).toEqual(plain);
    } finally {
      store.close();
    }
  });

  test("ftsWeight scales the FTS contribution only — vec-leg scores stay untouched", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      // "quick" FTS-matches only fox-quick (FTS rank 1). The query vector sits on canine's axis
      // (vec rank 1); fox-quick is vec rank 3. So fox-quick = w/(K+1) + 1/(K+3) and
      // canine = 1/(K+1) exactly — the weight must scale ONLY the FTS term.
      const query = { queryText: "quick", queryVector: [0.95, 0.05, 0] };
      const score = (hits: { id: string; score: number }[], id: string) =>
        hits.find((h) => h.id === id)?.score ?? Number.NaN;
      const symmetric = store.hybridSearch(query);
      const weighted = store.hybridSearch({ ...query, ftsWeight: 3 });
      // vec-only doc: identical score under any weight.
      expect(score(weighted, "canine")).toBeCloseTo(
        score(symmetric, "canine"),
        12,
      );
      // FTS rank-1 contribution grew from 1/(60+1) to 3/(60+1): delta is exactly 2/61.
      expect(
        score(weighted, "fox-quick") - score(symmetric, "fox-quick"),
      ).toBeCloseTo(2 / 61, 12);
    } finally {
      store.close();
    }
  });

  test("a non-positive or non-finite ftsWeight throws (flag-never-guess)", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      seed(store);
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          store.hybridSearch({ queryText: "fox", ftsWeight: bad }),
        ).toThrow(ValidationError);
      }
    } finally {
      store.close();
    }
  });
});
