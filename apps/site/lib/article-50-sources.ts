import type { RegulatorySource } from "./regulatory-source";

export const ARTICLE_50_VERIFIED_ON = "2026-07-27";

/**
 * Primary-source contract shared by the evergreen Article 50 surfaces, the dated writing
 * record, and the report-only claim watch. `locator` stays publication-grade even where an
 * upstream bot challenge or PDF prevents literal text inspection; `watch` records that
 * mechanical limitation explicitly instead of weakening the displayed citation.
 */
export const ARTICLE_50_PRIMARY_SOURCES = [
  {
    label: "Regulation (EU) 2024/1689 on EUR-Lex",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en",
    locator:
      "Articles 3(3)–(4), 50(1)–(5), 99(4), 99(6), 100(3), and 113; OJ pp. 82–83, 115–117, and 123/144",
    watch: {
      mode: "reachable",
      reason:
        "EUR-Lex serves an automated-client interstitial, so the watch can verify reachability but not the rendered locator.",
    },
  },
  {
    label: "European Commission final-guidelines landing page",
    url: "https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems",
    locator:
      "Page header “Publication 20 July 2026”; introductory paragraph beginning “The Commission adopted these guidelines”",
    watch: {
      mode: "text",
      texts: [
        "Publication 20 July 2026",
        "The Commission adopted these guidelines",
      ],
    },
  },
  {
    label: "European Commission final Article 50 guidelines",
    url: "https://ec.europa.eu/newsroom/dae/redirection/document/131215",
    locator:
      "Paragraphs (5), (6), (69)–(74), (151), and (153)–(154), pp. 3–4, 24–25, and 49–50",
    watch: {
      mode: "digest",
      algorithm: "sha256",
      digest:
        "30861fc5de31205846f023068069c92fabc7271ebeac6af7bef68b97f0a33f66",
      reason:
        "The official source is a 51-page PDF; any byte-level change is reported for human review against the precise page locator.",
    },
  },
  {
    label: "European Commission quick facts on AI transparency",
    url: "https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems",
    locator:
      "“Enforcement and penalties” → “Surveillance authorities”, “Penalties”, and “Exceptions”",
    watch: {
      mode: "text",
      texts: [
        "These transparency rules apply from 2 August 2026.",
        "Grace period for marking obligation until December 2026 for generative AI systems placed on the market before 2 August 2026 (Article 50(2) AI Act, amended by AI Omnibus).",
        "Deepfakes generated before 2 August 2026: no mandatory retroactive labelling but encouraged.",
      ],
    },
  },
  {
    label: "Council adopted Digital Omnibus legislative text",
    url: "https://data.consilium.europa.eu/doc/document/PE-30-2026-INIT/en/pdf",
    locator:
      "Article 111(4), p. 90/102, and Article 4, p. 101/102: systems “placed on the market before 2 August 2026”; compliance with Article 50(2) by 2 December 2026; entry into force on the third day after Official Journal publication",
    watch: {
      mode: "reachable",
      reason:
        "The Council source is a 102-page binary legislative PDF. The report-only watch verifies reachability; human review uses the precise article and page locator.",
    },
  },
  {
    label: "Council final-approval and next-steps notice",
    url: "https://skribi.consilium.europa.eu/en/press/press-releases/2026/06/29/artificial-intelligence-council-gives-final-green-light-to-simplify-and-streamline-rules/",
    locator:
      "Page header dated 29 June 2026; opening paragraph beginning “Today, the Council gave its final green light”; “Next steps” paragraph on Official Journal publication and entry into force",
    watch: {
      mode: "text",
      texts: [
        "Today, the Council gave its final green light",
        "The legislative act will be published in the EU’s official journal shortly",
        "will enter into force on the third day after this publication",
      ],
    },
  },
] as const satisfies readonly RegulatorySource[];

/**
 * Claim-specific locators for the shorter evergreen framework summary. Keep the full source
 * records above publication-complete for the detailed page and writing piece; this subset names
 * only the clauses and guidance paragraphs the summary itself relies on.
 */
export const ARTICLE_50_SUMMARY_SOURCES = [
  {
    ...ARTICLE_50_PRIMARY_SOURCES[0],
    locator: "Articles 50(1)–(2), 50(4), and 113; OJ pp. 82 and 123/144",
  },
  {
    ...ARTICLE_50_PRIMARY_SOURCES[2],
    locator: "Paragraphs (69)–(74) and (153)–(154), pp. 24–25 and 49–50",
  },
  ARTICLE_50_PRIMARY_SOURCES[4],
  ARTICLE_50_PRIMARY_SOURCES[5],
] as const satisfies readonly RegulatorySource[];
