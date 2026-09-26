// The local-store poke's checkable claims, now that it drives the REAL @caisson-sh/local-store through
// its `./browser` entry and the hand-ported mirror (local-store-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build (a
//      bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0). This is
//      the package where that matters most: `bun:sqlite` is not `node:`-prefixed, so the walk's
//      external frontier, not its offender list, is what proves the SQLite half stayed out.
//   2. The fusion is the SHIPPED `fuseByRrf` — the same function `LocalStore.hybridSearch` calls —
//      so the poke's fused output is byte-for-byte a real hybrid run's, not a lookalike. This test
//      runs under bun (bun:sqlite + sqlite-vec resolve fine here) and opens a real store to say so.
//   3. What CANNOT come along stays honest: the two per-leg rankings are precomputed SAMPLE data,
//      and they are re-derived here against that real store, so a drifted capture fails.
//   4. The ftsWeight guard is the package's real ValidationError, not a client-side copy of one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import { LocalStore, RRF_K as REAL_RRF_K } from "@caisson-sh/local-store";
import type { StoreDoc } from "@caisson-sh/local-store";

import {
  SAMPLE_DOCS,
  SAMPLE_QUERY_TEXT,
  fuseSample,
  type SampleDoc,
} from "./local-store-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "local-store-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past its browser entry", () => {
    expect(walk.files).toContain("packages/local-store/src/browser.ts");
    expect(walk.files).toContain("packages/local-store/src/rrf.ts");
    // …and never the SQLite half, which has no browser form at all.
    expect(walk.files).not.toContain("packages/local-store/src/store.ts");
    expect(walk.files).not.toContain("packages/local-store/src/tenant-db.ts");
  });

  test("`bun:sqlite` never reaches the client graph — the offender channel cannot catch it", () => {
    // A `bun:`-prefixed specifier is not `node:`-prefixed, so it lands on the external frontier
    // rather than in `offenders`. Asserting the frontier is what closes that hole.
    expect(walk.external).not.toContain("bun:sqlite");
    expect(walk.external).not.toContain("sqlite-vec");
  });

  test("positive control: the walker is not blind — the `.` barrel DOES report offenders", () => {
    const barrel = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/local-store/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(barrel.offenders.some((o) => o.file.endsWith("src/store.ts"))).toBe(
      true,
    );
    expect(barrel.external).toContain("bun:sqlite");
  });
});

test("the poke's RRF_K slider is anchored on the package's real exported constant", () => {
  expect(REAL_RRF_K).toBe(60);
});

describe("fuseSample parity vs a live real-package run (this poke's 8-doc corpus)", () => {
  // The exact corpus + query SAMPLE_DOCS/SAMPLE_QUERY_TEXT were captured from. dim 3, hand-picked
  // embeddings, never a live embedder call.
  const REAL_DOCS: StoreDoc[] = [
    {
      id: "billing-refund",
      text: "A refund is issued to the original payment method within five business days.",
      embedding: [1, 0, 0],
    },
    {
      id: "credit-expiry",
      text: "Purchased credits never expire and roll over month to month automatically.",
      embedding: [0.9, 0.1, 0],
    },
    {
      id: "hybrid-fusion",
      text: "Reciprocal rank fusion blends a vector ranking and a keyword ranking into one combined score.",
      embedding: [0.85, 0.15, 0],
    },
    {
      id: "offline-mode",
      text: "The local store runs entirely on disk, no cloud vector database, no network call ever leaves the box.",
      embedding: [0.55, 0, 0.4],
    },
    {
      id: "tenant-isolation",
      text: "Every tenant gets its own SQLite file, so one tenant's data never touches another tenant's.",
      embedding: [0.3, 0.1, 0.55],
    },
    {
      id: "keyword-search",
      text: "Keyword search matches exact terms and ranks by how rare and frequent they are across the corpus.",
      embedding: [0.15, 0.6, 0.1],
    },
    {
      id: "support-ticket",
      text: "Open a support ticket and a refund is processed once the account is verified.",
      embedding: [0.05, 0.05, 0.7],
    },
    {
      id: "vector-search",
      text: "Vector search finds semantically similar passages even when the exact words differ.",
      embedding: [0, 0.85, 0.15],
    },
  ];
  const QUERY_VECTOR = [1, 0, 0];

  test("the sample corpus is the real one, in the real upsert order (the fused key IS the rowid)", () => {
    expect(SAMPLE_DOCS.map((d) => d.id)).toEqual(REAL_DOCS.map((d) => d.id));
    expect(SAMPLE_DOCS.map((d) => d.snippet)).toEqual(
      REAL_DOCS.map((d) => d.text),
    );
  });

  function seeded(): LocalStore {
    const store = LocalStore.open({ dim: 3 });
    for (const doc of REAL_DOCS) store.upsert(doc);
    return store;
  }

  function rankMap(hits: { id: string }[]): Map<string, number> {
    const ranks = new Map<string, number>();
    hits.forEach((hit, i) => ranks.set(hit.id, i + 1));
    return ranks;
  }

  test("SAMPLE_DOCS.vecRank matches the real vec-only leg order (blank queryText)", () => {
    const store = seeded();
    try {
      const ranks = rankMap(
        store.hybridSearch({
          queryText: "",
          queryVector: QUERY_VECTOR,
          limit: 10,
        }),
      );
      for (const doc of SAMPLE_DOCS) {
        expect(doc.vecRank).toBe(ranks.get(doc.id) ?? null);
      }
    } finally {
      store.close();
    }
  });

  test("SAMPLE_DOCS.ftsRank matches the real FTS-only leg order (omitted queryVector)", () => {
    const store = seeded();
    try {
      const ranks = rankMap(
        store.hybridSearch({ queryText: SAMPLE_QUERY_TEXT, limit: 10 }),
      );
      for (const doc of SAMPLE_DOCS) {
        expect(doc.ftsRank).toBe(ranks.get(doc.id) ?? null);
      }
    } finally {
      store.close();
    }
  });

  test("fuseSample at the defaults matches the real hybrid fused output exactly", () => {
    const store = seeded();
    try {
      const real = store.hybridSearch({
        queryText: SAMPLE_QUERY_TEXT,
        queryVector: QUERY_VECTOR,
        limit: 10,
      });
      const poke = fuseSample(SAMPLE_DOCS, {
        rrfK: REAL_RRF_K,
        ftsWeight: 1,
        includeVector: true,
      });
      expect(poke.map((h) => h.id)).toEqual(real.map((h) => h.id));
      real.forEach((hit, i) => {
        expect(poke[i]?.score).toBe(hit.score);
      });
      // The narrative this poke exists to show: a doc weak in the vector leg (rank 7) but with an
      // exact keyword hit gets pulled up to rank 2 by fusion, never merely echoing one leg's order.
      expect(poke[0]?.id).toBe("billing-refund");
      expect(poke[1]?.id).toBe("support-ticket");
    } finally {
      store.close();
    }
  });

  test("fuseSample with ftsWeight=3 matches the real package's weighted fusion", () => {
    const store = seeded();
    try {
      const real = store.hybridSearch({
        queryText: SAMPLE_QUERY_TEXT,
        queryVector: QUERY_VECTOR,
        limit: 10,
        ftsWeight: 3,
      });
      const poke = fuseSample(SAMPLE_DOCS, {
        rrfK: REAL_RRF_K,
        ftsWeight: 3,
        includeVector: true,
      });
      expect(poke.map((h) => h.id)).toEqual(real.map((h) => h.id));
      real.forEach((hit, i) => {
        expect(poke[i]?.score).toBe(hit.score);
      });
    } finally {
      store.close();
    }
  });

  test("includeVector=false degrades to the real FTS5-only order and drops every vec-only doc", () => {
    const store = seeded();
    try {
      const real = store.hybridSearch({
        queryText: SAMPLE_QUERY_TEXT,
        limit: 10,
      });
      const poke = fuseSample(SAMPLE_DOCS, {
        rrfK: REAL_RRF_K,
        ftsWeight: 1,
        includeVector: false,
      });
      expect(poke.map((h) => h.id)).toEqual(real.map((h) => h.id));
      expect(poke.map((h) => h.id)).toEqual([
        "billing-refund",
        "support-ticket",
      ]);
    } finally {
      store.close();
    }
  });

  test("a different rrfK still fuses in real-formula shape (higher K compresses the legs together)", () => {
    const lowK = fuseSample(SAMPLE_DOCS, {
      rrfK: 1,
      ftsWeight: 1,
      includeVector: true,
    });
    const highK = fuseSample(SAMPLE_DOCS, {
      rrfK: 1000,
      ftsWeight: 1,
      includeVector: true,
    });
    expect(lowK.length).toBe(SAMPLE_DOCS.length);
    expect(highK.length).toBe(SAMPLE_DOCS.length);
    for (const hits of [lowK, highK]) {
      for (let i = 1; i < hits.length; i++) {
        expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
      }
    }
  });

  test("a bad ftsWeight throws the package's REAL ValidationError, matching the store's own refusal", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      store.upsert({ id: "x", text: "x" });
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        let storeErr: unknown;
        try {
          store.hybridSearch({ queryText: "x", ftsWeight: bad });
        } catch (err) {
          storeErr = err;
        }
        expect(storeErr).toBeInstanceOf(ValidationError);

        let pokeErr: unknown;
        try {
          fuseSample(SAMPLE_DOCS, {
            rrfK: REAL_RRF_K,
            ftsWeight: bad,
            includeVector: true,
          });
        } catch (err) {
          pokeErr = err;
        }
        expect(pokeErr).toBeInstanceOf(ValidationError);
        expect((pokeErr as ValidationError).message).toBe(
          (storeErr as ValidationError).message,
        );
      }
    } finally {
      store.close();
    }
  });
});

describe("golden parity vs the package's own committed fixture", () => {
  // Reproduces golden.ts's RRF_FIXTURE corpus + query byte for byte (ADR-0013 golden-first, the
  // committed fixture is this package's spec; the poke never invents its own numbers).
  const goldenDocs: StoreDoc[] = [
    { id: "fox", text: "fox", embedding: [1, 0, 0] },
    { id: "fox-quick", text: "fox fox fox quick", embedding: [0, 1, 0] },
    {
      id: "canine",
      text: "canine animal companion",
      embedding: [0.95, 0.05, 0],
    },
    { id: "lazy-fox", text: "the lazy fox", embedding: [0, 0, 0.8] },
  ];
  const goldenQueryText = "fox";
  const goldenQueryVector = [1, 0, 0];

  const fixtureSchema = z.array(
    z.object({ rank: z.number().int(), id: z.string(), score: z.number() }),
  );
  const fixture = fixtureSchema.parse(
    JSON.parse(
      readFileSync(
        // packages/local-store/src/__golden__/rrf-ranking.json, resolved from this file's own
        // directory (apps/demos/components/poke/) so a glob-guessed path can never silently drift.
        join(
          WORKSPACE_ROOT,
          "packages",
          "local-store",
          "src",
          "__golden__",
          "rrf-ranking.json",
        ),
        "utf8",
      ),
    ),
  );

  function seededGolden(): LocalStore {
    const store = LocalStore.open({ dim: 3 });
    for (const doc of goldenDocs) store.upsert(doc);
    return store;
  }

  test("the real package reproduces its own committed golden (sanity, proves the fixture is current)", () => {
    const store = seededGolden();
    try {
      const real = store.hybridSearch({
        queryText: goldenQueryText,
        queryVector: goldenQueryVector,
        limit: 10,
      });
      expect(
        real.map((h, i) => ({
          rank: i + 1,
          id: h.id,
          score: Number(h.score.toFixed(6)),
        })),
      ).toEqual(fixture);
    } finally {
      store.close();
    }
  });

  test("the poke's projection reproduces the committed golden from the fixture's own leg ranks", () => {
    const store = seededGolden();
    let vecRanks: Map<string, number>;
    let ftsRanks: Map<string, number>;
    try {
      const vecOnly = store.hybridSearch({
        queryText: "",
        queryVector: goldenQueryVector,
        limit: 10,
      });
      const ftsOnly = store.hybridSearch({
        queryText: goldenQueryText,
        limit: 10,
      });
      vecRanks = new Map(vecOnly.map((h, i) => [h.id, i + 1]));
      ftsRanks = new Map(ftsOnly.map((h, i) => [h.id, i + 1]));
    } finally {
      store.close();
    }

    const docs: SampleDoc[] = goldenDocs.map((d) => ({
      id: d.id,
      snippet: d.text,
      vecRank: vecRanks.get(d.id) ?? null,
      ftsRank: ftsRanks.get(d.id) ?? null,
    }));

    const poke = fuseSample(docs, {
      rrfK: REAL_RRF_K,
      ftsWeight: 1,
      includeVector: true,
    });
    expect(
      poke.map((h, i) => ({
        rank: i + 1,
        id: h.id,
        score: Number(h.score.toFixed(6)),
      })),
    ).toEqual(fixture);
  });
});
