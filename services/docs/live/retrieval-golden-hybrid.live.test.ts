// live/retrieval-golden-hybrid.live.test.ts — the LIVE fusion-path proof (2026-07-10). Runs the
// SAME (question -> expected source) golden pairs as ../src/retrieval-golden.integration.test.ts
// (both import ../src/golden-pairs.ts, so there's one list, not two driftable copies) through the
// REAL retrieval path: the real corpus, the real OpenRouter qwen3-embedding-8b
// embedder (openrouter-embedder.ts, wrapped in the local content-hash cache from embed-cache.ts so
// repeat runs are near-free), and DocsIndex's RRF-fused vec+FTS search — the path the deterministic
// FTS5-floor CI suite never exercises.
//
// ADR-0201 live-test convention: lives OUTSIDE ./src (CI / the published tarball never see it; run
// via `bun run test:live`) and self-skips without OPENROUTER_API_KEY.
//
// RESOLVED (CAISSON-83, 2026-07-12 kickoff P): the 2026-07-10 install-question miss — bundle
// MARKETING pages with no install steps crowding getting-started.mdx out of the window — is gone.
// Two things closed it: (1) the per-bundle "## Install" sections (CAISSON-84, operator lock) made
// every bundle page a TRUE answer to the generic install question, captured as the golden's
// `expectedAnyOf` set; (2) DocsIndex.search now caps chunks per source in the window and
// local-store exposes an ftsWeight lever (both landed at measured-safe defaults — the 2026-07-12
// sweep over this whole suite picked them). The former test.todo below is a live assertion now.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { buildCorpus, loadPricingFacts } from "../src/corpus.ts";
import { CachedEmbedder } from "../src/embed-cache.ts";
import { GOLDENS, satisfies } from "../src/golden-pairs.ts";
import { DocsIndex } from "../src/index-store.ts";
import {
  createOpenRouterEmbedder,
  OPENROUTER_EMBED_MODEL,
} from "../src/openrouter-embedder.ts";

const KEY = process.env.OPENROUTER_API_KEY ?? "";
const HAVE_KEY = KEY.length > 0;

// A full COLD embed of the real corpus (458 chunks, 2026-07-10 live probe under a rate-limited
// stretch) took ~7.5 minutes; a warm-cache rerun is seconds. Generous on the phase deadline so a
// fresh checkout's first run never spuriously degrades to the FTS floor via index-store.ts's own
// embed-phase-deadline guard (default 180s — too tight for this corpus size today).
const EMBED_PHASE_DEADLINE_MS = 600_000;
const SEARCH_TEST_TIMEOUT_MS = 30_000; // one query-time embed call, generous for a real network hop

// Uncommitted, machine-local — content-hash keyed, so it's safe to reuse across runs/branches; a
// corpus/model change just misses and re-embeds those entries.
const CACHE_PATH = join(tmpdir(), "caisson-docs-embed-cache.json");

// Build the corpus the way `server.ts` does — WITH the generated pricing sources. This file used to
// call bare `buildCorpus()`, the same blind spot the CI harness carried: it shares `GOLDENS` with
// that harness, so the pricing pairs could never pass here, and this is the ONE suite that exercises
// the real hybrid path production serves on. Still a pure filesystem read, so no need to gate on
// HAVE_KEY. Fails loud rather than degrading to a docs-only corpus.
const pricingFacts = await loadPricingFacts();
if (pricingFacts === null) {
  throw new Error(
    "loadPricingFacts() returned null — apps/site/lib/pricing.ts must be reachable for the pricing goldens",
  );
}
const corpus = buildCorpus({ pricingFacts });

let index: DocsIndex | undefined;
let embedder: CachedEmbedder | undefined;
if (HAVE_KEY) {
  embedder = new CachedEmbedder(
    createOpenRouterEmbedder({ apiKey: KEY }),
    CACHE_PATH,
    OPENROUTER_EMBED_MODEL,
  );
  // Module top-level await (matches retrieval-golden.integration.test.ts's convention): the build
  // cost is paid once for the whole file, so it is never subject to any single test()'s timeout.
  index = await DocsIndex.build(corpus.chunks, embedder, {
    embedPhaseDeadlineMs: EMBED_PHASE_DEADLINE_MS,
  });
  embedder.save();
}

/** Fails loudly if a test body somehow runs without the live index built — should be unreachable,
 *  since every test below is `skipIf(!HAVE_KEY)`, but this avoids a non-null assertion. */
function liveIndex(): DocsIndex {
  if (!index)
    throw new Error("live index not built — OPENROUTER_API_KEY missing");
  return index;
}

afterAll(() => {
  index?.close();
});

describe("golden retrieval (live hybrid fusion, real corpus + real OpenRouter embeddings)", () => {
  // Every pair — including the formerly-todo'd install question (CAISSON-83, resolved 2026-07-12:
  // the window must carry ANY page with real install steps, per the golden's expectedAnyOf set).
  for (const g of GOLDENS) {
    test.skipIf(!HAVE_KEY)(
      `"${g.question}" surfaces ${g.expected} in top-${String(g.k)}`,
      async () => {
        const hits = await liveIndex().search(g.question, g.k);
        expect(hits.some((h) => satisfies(g, h))).toBe(true);
      },
      SEARCH_TEST_TIMEOUT_MS,
    );
  }
});
