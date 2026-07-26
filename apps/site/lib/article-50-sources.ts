import type { WritingSource } from "./writing";

export const ARTICLE_50_VERIFIED_ON = "2026-07-26";

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
      "Articles 50(1)–(5), 99(4), 99(6), 100(3), and 113; OJ pp. 82–83, 115–117, and 123/144",
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
      text: "Publication 20 July 2026",
    },
  },
  {
    label: "European Commission final Article 50 guidelines",
    url: "https://ec.europa.eu/newsroom/dae/redirection/document/131215",
    locator:
      "Paragraphs (5), (6), (69)–(74), and (153)–(154), pp. 3–4, 24–25, and 49–50",
    watch: {
      mode: "reachable",
      reason:
        "The official source is a 51-page PDF; the watch verifies the public download while the page locator remains the review anchor.",
    },
  },
  {
    label: "European Commission quick facts on AI transparency",
    url: "https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems",
    locator: "“Enforcement and penalties” → “Exceptions”",
    watch: {
      mode: "text",
      text: "Exceptions",
    },
  },
] as const satisfies readonly WritingSource[];
