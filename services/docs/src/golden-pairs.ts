// src/golden-pairs.ts — the shared (question → expected source) retrieval goldens (2026-07-10).
// Plain data module (NOT a *.test.ts) so both the FTS-floor CI suite
// (retrieval-golden.integration.test.ts) and the live hybrid-fusion suite
// (../live/retrieval-golden-hybrid.live.test.ts) import the SAME list without either one's `bun
// test` run transitively re-executing the other's `describe`/`test` registrations as an import
// side effect (which happens if you import a *.test.ts file directly — Bun runs a test file's
// top-level code, tests included, the moment it's imported for any reason).
//
// Golden discipline: every (question → source) pair below was verified true at authoring time. If
// one fails after an intentional corpus/ranking change, re-verify the pair by hand (bun repl / a
// probe script) before touching the expectation — loosening k to green a regression defeats the test.
export interface GoldenPair {
  question: string;
  expected: string;
  /**
   * When set, the pair passes if the window carries ANY of these sources (`expected` is the
   * canonical first-among-equals, kept for reporting). For questions the corpus deliberately
   * answers on several pages — the 2026-07-12 per-bundle Install sections made every bundle page
   * a true answer to the generic install question (operator lock, kickoff P) — a single-page pin
   * would punish the ranking for surfacing a better-targeted true answer.
   */
  expectedAnyOf?: string[];
  k: number;
}

/** The sources that satisfy `pair` — `expectedAnyOf` when present, else the single `expected`. */
export function acceptedSources(pair: GoldenPair): string[] {
  return pair.expectedAnyOf ?? [pair.expected];
}

export const GOLDENS: GoldenPair[] = [
  {
    question: "how do I install a bundle",
    expected: "apps/site/content/docs/getting-started.mdx",
    // Any page carrying real install steps is a true answer since the per-bundle Install
    // sections landed (each bundle page now holds the exact commands for that bundle).
    expectedAnyOf: [
      "apps/site/content/docs/getting-started.mdx",
      "apps/site/content/docs/compliance/index.mdx",
      "apps/site/content/docs/ai-production/index.mdx",
      "apps/site/content/docs/local-first/index.mdx",
      "apps/site/content/docs/agentic-dev/index.mdx",
      "apps/site/content/docs/provenance/index.mdx",
      "apps/site/content/docs/everything/index.mdx",
    ],
    k: 3,
  },
  {
    question: "WORM audit storage on S3",
    expected: "apps/site/content/docs/provenance/audit-worm.mdx",
    // Re-verified by hand 2026-07-29, per the discipline note above — this pair was NOT loosened to
    // green a regression. The harness only just started building the corpus with the generated
    // pricing sources, which production has always had, so this is the first time the pair has been
    // measured against the real ranking. The `audit-worm` catalog entry ("Append-only SHA-256 audit
    // chain plus S3 Object-Lock WORM evidence storage") outranks the deep doc on plain term overlap,
    // and it is a true answer, not noise. The deep doc is #4, the package README #6.
    expectedAnyOf: [
      "apps/site/content/docs/provenance/audit-worm.mdx",
      "packages/audit-worm/README.md",
    ],
    k: 5,
  },
  {
    question: "does caisson require postgres",
    expected: "apps/site/content/docs/getting-started.mdx",
    k: 5,
  },
  {
    question: "cancel my subscription",
    expected: "apps/site/content/docs/base/billing.mdx",
    k: 5,
  },
  {
    question: "what license is the base substrate under",
    expected: "apps/site/content/docs/base/index.mdx",
    k: 3,
  },
  {
    question: "license key stopped working after renewal",
    expected: "packages/license-verify/README.md",
    k: 5,
  },
  {
    question: "What is the refund policy?",
    expected: "apps/site/content/docs/refunds.mdx",
    k: 5,
  },
  {
    question: "What happens when my updates window expires?",
    expected: "apps/site/content/docs/licensing.mdx",
    k: 3,
  },
  {
    question: "How do I renew my license after the first year?",
    expected: "apps/site/content/docs/licensing.mdx",
    k: 5,
  },
  {
    question: "How do I get started with the Local-first bundle?",
    expected: "apps/site/content/docs/local-first/index.mdx",
    k: 3,
  },
  {
    question: "How do I install the Provenance bundle?",
    expected: "apps/site/content/docs/provenance/index.mdx",
    k: 4,
  },
  // Plain buyer price questions (2026-07-29). These are NOT hypothetical: the live service was
  // observed answering "Compliance renewal price" with the $1,499 Updates plan, and a probe of the
  // real corpus then showed something worse — no plain price question put a single `pricing/*`
  // chunk in the top 5, on a corpus whose generated pricing docs exist for exactly this purpose.
  // The heading `## Compliance — $1,649` shares no token with "how much" or "cost", and FTS has no
  // synonyms. `pricing/bundles` and `pricing/modules` are generated sources, so pinning them here
  // costs nothing to maintain and fails loudly if the cost line is ever dropped.
  {
    question: "How much is the Compliance bundle",
    expected: "pricing/bundles",
    k: 3,
  },
  {
    question: "what does it cost to renew Compliance",
    // The licensing page owns the renewal POLICY and carries a per-bundle table; the generated
    // pricing doc carries the same figure next to the bundle. Either is a true answer.
    expected: "pricing/bundles",
    expectedAnyOf: ["pricing/bundles", "apps/site/content/docs/licensing.mdx"],
    k: 3,
  },
];
