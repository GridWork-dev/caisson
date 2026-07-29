// Golden retrieval quality (2026-07-10). Integration: builds the REAL corpus and asserts that
// natural-language buyer questions surface the expected source within the top-k — on the
// deterministic FTS5 floor (no embedder, no network), so the assertion is stable in CI.
//
// WHY THIS EXISTS: the 2026-07-10 support-bot battery found retrieval returning identical
// off-topic chunks for every question. The root cause (@caisson/local-store wrapping the whole
// query as ONE FTS5 phrase — zero rows for any multi-word query) had shipped and run in
// production undetected because nothing asserted end-to-end retrieval quality; the bot's
// fail-closed confidence gate politely hid the failure behind escalations. These goldens make
// that whole class loud: a ranking/tokenization regression that pushes a known-answerable
// question's source out of the top-k fails CI.
//
// Golden discipline: every (question → source) pair below was verified true at authoring time.
// If one fails after an intentional corpus/ranking change, re-verify the pair by hand (bun
// repl / a probe script) before touching the expectation — loosening k to green a regression
// defeats the test.
import { afterAll, describe, expect, test } from "bun:test";
import { buildCorpus, loadPricingFacts } from "./corpus.ts";
import { GOLDENS, satisfies } from "./golden-pairs.ts";
import { DocsIndex } from "./index-store.ts";

// Build the corpus the way `server.ts` does — WITH the generated pricing sources. This harness used
// to call bare `buildCorpus()`, which meant the ~40 `pricing/*` chunks that answer every buyer price
// question had ZERO golden coverage while the suite read as covering retrieval end to end. That gap
// is how the live price-question failures reached production green.
const pricingFacts = await loadPricingFacts();
if (pricingFacts === null) {
  // Fail loud rather than silently running a docs-only corpus: the pricing goldens below cannot
  // pass without these sources, and a confusing top-k miss is a worse signal than a clear abort.
  throw new Error(
    "loadPricingFacts() returned null — apps/site/lib/pricing.ts must be reachable for the pricing goldens",
  );
}
const corpus = buildCorpus({ pricingFacts });
const index = await DocsIndex.build(corpus.chunks); // no embedder ⇒ deterministic FTS5 floor

afterAll(() => {
  index.close();
});

describe("golden retrieval (FTS floor, real corpus)", () => {
  for (const g of GOLDENS) {
    test(`"${g.question}" surfaces ${g.expected} in top-${String(g.k)}`, async () => {
      const hits = await index.search(g.question, g.k);
      expect(hits.some((h) => satisfies(g, h))).toBe(true);
    });
  }

  test("every multi-word question returns a non-empty result set (the zero-rows regression)", async () => {
    // The exact failure mode of the shipped bug: multi-word ⇒ zero FTS rows. Punctuation and
    // question marks ride along because real users type them.
    for (const q of [
      "What is the refund policy?",
      "how do credits expire",
      "can I use my own S3 bucket for audit storage?",
      ...GOLDENS.map((g) => g.question),
    ]) {
      const hits = await index.search(q, 5);
      expect(hits.length).toBeGreaterThan(0);
    }
  });
});
