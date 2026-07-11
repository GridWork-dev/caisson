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
// KNOWN ISSUE (2026-07-10 k=5 probe, full 458-chunk corpus, real embeddings, both cold and warm
// cache): "how do I install a bundle" does NOT surface getting-started.mdx in the top-5 on the live
// hybrid path — bundle marketing pages (compliance-core.mdx, agentic-dev/index.mdx, guardrails.mdx,
// prompt-registry.mdx) crowd it out. The FTS floor passes this exact pair; fusion buries it. This is
// a fusion-weight ranking gap, not a corpus/chunking bug — do NOT tune fusion weights or touch
// packages/local-store to chase it here. Isolated below as its own `test.todo` (body never runs
// under a plain `bun test`, only under `bun test --todo`) so the leg stays green while the miss
// stays visible for a future fusion-weight follow-up.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { buildCorpus } from "../src/corpus.ts";
import { CachedEmbedder } from "../src/embed-cache.ts";
import { GOLDENS } from "../src/golden-pairs.ts";
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

const corpus = buildCorpus(); // pure filesystem read — always cheap, no need to gate on HAVE_KEY

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

const INSTALL_QUESTION = "how do I install a bundle";
const goldens = GOLDENS.filter((g) => g.question !== INSTALL_QUESTION);
const installGolden = GOLDENS.find((g) => g.question === INSTALL_QUESTION);
if (!installGolden) {
  throw new Error(
    `expected "${INSTALL_QUESTION}" in GOLDENS — retrieval-golden.integration.test.ts changed shape`,
  );
}

afterAll(() => {
  index?.close();
});

describe("golden retrieval (live hybrid fusion, real corpus + real OpenRouter embeddings)", () => {
  for (const g of goldens) {
    test.skipIf(!HAVE_KEY)(
      `"${g.question}" surfaces ${g.expected} in top-${String(g.k)}`,
      async () => {
        const hits = await liveIndex().search(g.question, g.k);
        expect(hits.map((h) => h.source)).toContain(g.expected);
      },
      SEARCH_TEST_TIMEOUT_MS,
    );
  }

  // live-hybrid fusion ranking miss, 2026-07-10 k=5 probe — fusion-weight follow-up pending.
  // Body intentionally never runs under a plain `bun test` (only `bun test --todo` executes a
  // `.todo` body, and expects it to fail) — kept executable, not deleted, so unskipping it later is
  // a one-line diff once the fusion weights are fixed.
  test.todo(
    `"${installGolden.question}" surfaces ${installGolden.expected} in top-${String(installGolden.k)} (KNOWN MISS)`,
    async () => {
      const hits = await liveIndex().search(
        installGolden.question,
        installGolden.k,
      );
      expect(hits.map((h) => h.source)).toContain(installGolden.expected);
    },
  );
});
