// Golden + live parity for the local-store poke's mirror (ADR-0378 lock 2): the fusion formula in
// local-store-logic.ts must reproduce, bit for bit, both (a) the real @caisson/local-store package's
// LocalStore.hybridSearch() output for this poke's own 8-doc sample corpus, and (b) the package's OWN
// committed golden fixture (packages/local-store/src/__golden__/rrf-ranking.json). This test imports
// the real package directly. It runs under bun (bun:sqlite + sqlite-vec resolve fine here), unlike
// the browser bundle the poke component ships in.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ValidationError } from "@caisson/kernel";
import { LocalStore, RRF_K as REAL_RRF_K } from "@caisson/local-store";
import type { StoreDoc } from "@caisson/local-store";

import {
  RRF_K,
  SAMPLE_DOCS,
  SAMPLE_QUERY_TEXT,
  ValidationErrorMirror,
  fuseRrf,
} from "./local-store-logic";
import type { SampleDoc } from "./local-store-logic";

test("RRF_K matches the real package's exported constant", () => {
  expect(RRF_K).toBe(REAL_RRF_K);
  expect(RRF_K).toBe(60);
});

describe("ValidationErrorMirror parity vs the real ValidationError", () => {
  test("code, httpStatus, and the ftsWeight message match", () => {
    const store = LocalStore.open({ dim: 3 });
    try {
      store.upsert({ id: "x", text: "x" });
      let real: unknown;
      try {
        store.hybridSearch({ queryText: "x", ftsWeight: 0 });
      } catch (err) {
        real = err;
      }
      expect(real).toBeInstanceOf(ValidationError);
      const mirror = new ValidationErrorMirror(
        "ftsWeight must be a positive finite number",
      );
      expect(mirror.code).toBe((real as ValidationError).code);
      expect(mirror.httpStatus).toBe((real as ValidationError).httpStatus);
      expect(mirror.message).toBe((real as ValidationError).message);
    } finally {
      store.close();
    }
  });

  test("fuseRrf fails closed on every non-positive or non-finite ftsWeight, mirroring the real throw", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        fuseRrf(SAMPLE_DOCS, {
          rrfK: RRF_K,
          ftsWeight: bad,
          includeVector: true,
        }),
      ).toThrow(ValidationErrorMirror);
    }
  });
});

describe("SAMPLE_DOCS + fuseRrf parity vs a live real-package run (this poke's 8-doc corpus)", () => {
  // The exact corpus + query local-store-logic.ts's SAMPLE_DOCS/SAMPLE_QUERY_TEXT were captured
  // from. dim 3, hand-picked embeddings, never a live embedder call.
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
      const vecOnly = store.hybridSearch({
        queryText: "",
        queryVector: QUERY_VECTOR,
        limit: 10,
      });
      const ranks = rankMap(vecOnly);
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
      const ftsOnly = store.hybridSearch({
        queryText: SAMPLE_QUERY_TEXT,
        limit: 10,
      });
      const ranks = rankMap(ftsOnly);
      for (const doc of SAMPLE_DOCS) {
        expect(doc.ftsRank).toBe(ranks.get(doc.id) ?? null);
      }
    } finally {
      store.close();
    }
  });

  test("fuseRrf(rrfK=RRF_K, ftsWeight=1, includeVector=true) matches the real hybrid fused output exactly", () => {
    const store = seeded();
    try {
      const real = store.hybridSearch({
        queryText: SAMPLE_QUERY_TEXT,
        queryVector: QUERY_VECTOR,
        limit: 10,
      });
      const mirrored = fuseRrf(SAMPLE_DOCS, {
        rrfK: RRF_K,
        ftsWeight: 1,
        includeVector: true,
      });
      expect(mirrored.map((h) => h.id)).toEqual(real.map((h) => h.id));
      real.forEach((hit, i) => {
        expect(mirrored[i]?.score).toBe(hit.score);
      });
      // The narrative this poke exists to show: a doc weak in the vector leg (rank 7) but with an
      // exact keyword hit gets pulled up to rank 2 by fusion, never merely echoing one leg's order.
      expect(mirrored[0]?.id).toBe("billing-refund");
      expect(mirrored[1]?.id).toBe("support-ticket");
    } finally {
      store.close();
    }
  });

  test("fuseRrf with ftsWeight=3 matches the real package's weighted fusion (CAISSON-83 lever)", () => {
    const store = seeded();
    try {
      const real = store.hybridSearch({
        queryText: SAMPLE_QUERY_TEXT,
        queryVector: QUERY_VECTOR,
        limit: 10,
        ftsWeight: 3,
      });
      const mirrored = fuseRrf(SAMPLE_DOCS, {
        rrfK: RRF_K,
        ftsWeight: 3,
        includeVector: true,
      });
      expect(mirrored.map((h) => h.id)).toEqual(real.map((h) => h.id));
      real.forEach((hit, i) => {
        expect(mirrored[i]?.score).toBe(hit.score);
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
      const mirrored = fuseRrf(SAMPLE_DOCS, {
        rrfK: RRF_K,
        ftsWeight: 1,
        includeVector: false,
      });
      expect(mirrored.map((h) => h.id)).toEqual(real.map((h) => h.id));
      expect(mirrored.map((h) => h.id)).toEqual([
        "billing-refund",
        "support-ticket",
      ]);
    } finally {
      store.close();
    }
  });

  test("a different rrfK still fuses in real-formula shape (higher K compresses every leg toward equal weight)", () => {
    const lowK = fuseRrf(SAMPLE_DOCS, {
      rrfK: 1,
      ftsWeight: 1,
      includeVector: true,
    });
    const highK = fuseRrf(SAMPLE_DOCS, {
      rrfK: 1000,
      ftsWeight: 1,
      includeVector: true,
    });
    // Both stay sorted score-descending and both still surface every doc reachable by some leg.
    expect(lowK.length).toBe(SAMPLE_DOCS.length);
    expect(highK.length).toBe(SAMPLE_DOCS.length);
    for (const hits of [lowK, highK]) {
      for (let i = 1; i < hits.length; i++) {
        expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
      }
    }
  });
});

describe("golden parity vs the package's own committed fixture (packages/local-store/src/__golden__/rrf-ranking.json)", () => {
  // Reproduces golden.ts's RRF_FIXTURE corpus + query byte for byte (ADR-0013 golden-first, the
  // committed fixture is this package's spec; local-store-logic.ts never invents its own numbers).
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
        // directory (apps/site/components/poke/) so a glob-guessed path can never silently drift.
        join(
          import.meta.dir,
          "..",
          "..",
          "..",
          "..",
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

  test("fuseRrf reproduces the committed golden when fed the golden fixture's own leg ranks", () => {
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

    const mirrored = fuseRrf(docs, {
      rrfK: RRF_K,
      ftsWeight: 1,
      includeVector: true,
    });
    expect(
      mirrored.map((h, i) => ({
        rank: i + 1,
        id: h.id,
        score: Number(h.score.toFixed(6)),
      })),
    ).toEqual(fixture);
  });
});
