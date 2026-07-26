import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { GLOSSARY_TERMS } from "./glossary";
import {
  ARTICLE_50_PRIMARY_SOURCES,
  ARTICLE_50_VERIFIED_ON,
} from "./article-50-sources";

const ARTICLE_PAGE = fileURLToPath(
  new URL("../app/frameworks/eu-ai-act/article-50/page.tsx", import.meta.url),
);
const FRAMEWORK_PAGE = fileURLToPath(
  new URL("../app/frameworks/eu-ai-act/page.tsx", import.meta.url),
);
const WRITING_PATH = "/writing/eu-ai-act-article-50-august-december-2026";

async function liveCopy(): Promise<readonly string[]> {
  const articlePage = await Bun.file(ARTICLE_PAGE).text();
  const frameworkPage = await Bun.file(FRAMEWORK_PAGE).text();
  const glossary = GLOSSARY_TERMS.find(
    (term) => term.slug === "eu-ai-act-article-50",
  );

  expect(glossary).toBeDefined();
  return [articlePage, frameworkPage, JSON.stringify(glossary)].map((copy) =>
    copy.replace(/\s+/gu, " "),
  );
}

describe("Article 50 primary-source regrounding", () => {
  test("declares the verified official sources with precise locators", () => {
    expect(ARTICLE_50_VERIFIED_ON).toBe("2026-07-26");
    expect(ARTICLE_50_PRIMARY_SOURCES.map((source) => source.url)).toEqual([
      "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en",
      "https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems",
      "https://ec.europa.eu/newsroom/dae/redirection/document/131215",
      "https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems",
    ]);
    for (const source of ARTICLE_50_PRIMARY_SOURCES) {
      expect(source.locator.length).toBeGreaterThan(20);
    }
    expect(ARTICLE_50_PRIMARY_SOURCES[0].locator).toContain(
      "Articles 3(3)–(4)",
    );
    expect(ARTICLE_50_PRIMARY_SOURCES[2].locator).toContain("(151)");
    expect(ARTICLE_50_PRIMARY_SOURCES[3].locator).toContain(
      "Surveillance authorities",
    );
    expect(ARTICLE_50_PRIMARY_SOURCES[2].watch).toMatchObject({
      mode: "digest",
      algorithm: "sha256",
      digest:
        "30861fc5de31205846f023068069c92fabc7271ebeac6af7bef68b97f0a33f66",
    });
    expect(ARTICLE_50_PRIMARY_SOURCES[3].watch).toMatchObject({
      mode: "text",
      texts: expect.arrayContaining([
        "These transparency rules apply from 2 August 2026.",
        "Grace period for marking obligation until December 2026 for generative AI systems placed on the market before 2 August 2026 (Article 50(2) AI Act, amended by AI Omnibus).",
        "Deepfakes generated before 2 August 2026: no mandatory retroactive labelling but encouraged.",
      ]),
    });
  });

  test("all three live surfaces carry the narrow December transition", async () => {
    for (const copy of await liveCopy()) {
      expect(copy).toContain("December 2, 2026");
      expect(copy).toContain("placed on the market or put into service before");
      expect(copy).toContain("marking and detection");
    }
  });

  test("all three live surfaces state the pre-existing-content boundary", async () => {
    for (const copy of await liveCopy()) {
      expect(copy).toContain("do not require retroactive");
      expect(copy).toContain("generated or manipulated before August 2, 2026");
    }
  });

  test("removes stale reporting and proof-of-compliance overclaims", async () => {
    const prohibited = [
      "independent reporting through 2026-07-07",
      "reporting through 2026-07-07",
      "record that proves",
      "obligation was met",
      "proving you met it",
      "Marking happens at the generation boundary",
    ];

    for (const copy of await liveCopy()) {
      for (const phrase of prohibited) {
        expect(copy.toLocaleLowerCase("en-US")).not.toContain(
          phrase.toLocaleLowerCase("en-US"),
        );
      }
    }
  });

  test("the evergreen Article 50 page names and links the dated analysis", async () => {
    const articlePage = await Bun.file(ARTICLE_PAGE).text();
    expect(articlePage).toContain(`href="${WRITING_PATH}"`);
    expect(articlePage).toContain("What the July 2026 final guidance settled");
  });
});
