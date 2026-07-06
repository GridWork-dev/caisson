// Unit tests for the PURE functions only — no live OpenRouter/PostHog call anywhere here.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DOC_PATH,
  ENGINES,
  buildRequestBody,
  detectCitation,
  findAiOverviewItem,
  insertSnapshot,
  parseQuestions,
  renderSnapshotSection,
} from "./aeo-probe";

describe("parseQuestions", () => {
  test("extracts exactly the 18 canonical questions from the live doc, in order", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    const questions = parseQuestions(doc);
    expect(questions).toHaveLength(18);
    expect(questions[0]).toBe(
      "What's the best SOC 2 starter kit for a Next.js SaaS?",
    );
    expect(questions[16]).toBe("What is Caisson (caisson.sh)?");
  });

  test("handles both standalone-line and inline numbered-quote forms", () => {
    const md = [
      '1. "Standalone question?"',
      '**Heading — 2:** 2. "Inline question one?" 3. "Inline question two?"',
    ].join("\n");
    expect(parseQuestions(md)).toEqual([
      "Standalone question?",
      "Inline question one?",
      "Inline question two?",
    ]);
  });

  test("empty input yields an empty array", () => {
    expect(parseQuestions("")).toEqual([]);
  });
});

describe("buildRequestBody", () => {
  test("attaches the web_search server tool only for engines that need it", () => {
    const grounded = ENGINES.find((e) => e.slug === "openai/gpt-5");
    const native = ENGINES.find((e) => e.slug === "perplexity/sonar-pro");
    expect(grounded).toBeDefined();
    expect(native).toBeDefined();
    const groundedBody = buildRequestBody(grounded!, "q");
    const nativeBody = buildRequestBody(native!, "q");
    expect(groundedBody.tools).toEqual([{ type: "openrouter:web_search" }]);
    expect(nativeBody.tools).toBeUndefined();
    expect(groundedBody.model).toBe("openai/gpt-5");
  });
});

describe("detectCitation", () => {
  test("detects a case-insensitive caisson mention with an excerpt", () => {
    const { cited, excerpt } = detectCitation(
      "For SOC 2 in Next.js, CAISSON.sh ships a fail-closed RLS template.",
    );
    expect(cited).toBe(true);
    expect(excerpt.toLowerCase()).toContain("caisson");
  });

  test("no mention yields cited: false and an empty excerpt", () => {
    expect(detectCitation("Try Vanta or Drata for SOC 2.")).toEqual({
      cited: false,
      excerpt: "",
    });
  });
});

describe("renderSnapshotSection + insertSnapshot", () => {
  const section = renderSnapshotSection(
    "2026-07-06",
    ENGINES,
    [
      {
        index: 1,
        question: "Q1?",
        engine: "openai/gpt-5",
        cited: true,
        excerpt: "mentions caisson",
      },
    ],
    "not run (DATAFORSEO_LOGIN/PASSWORD unset)",
  );

  test("section carries the date header and one row per probe", () => {
    expect(section).toContain("## 2026-07-06 run");
    expect(section).toContain("mentions caisson");
  });

  test("insertSnapshot appends below the marker", () => {
    const doc = [
      "# doc",
      "",
      "<!-- SNAPSHOTS BELOW THIS LINE — append-only, newest at the bottom -->",
      "",
    ].join("\n");
    const updated = insertSnapshot(doc, "2026-07-06", section);
    expect(updated).toContain(section);
    expect(updated.indexOf("SNAPSHOTS BELOW")).toBeLessThan(
      updated.indexOf(section),
    );
  });

  test("is idempotent: a second insert for the same date is a no-op", () => {
    const doc = [
      "# doc",
      "<!-- SNAPSHOTS BELOW THIS LINE — append-only, newest at the bottom -->",
    ].join("\n");
    const once = insertSnapshot(doc, "2026-07-06", section);
    const twice = insertSnapshot(
      once,
      "2026-07-06",
      "a different section body",
    );
    expect(twice).toBe(once);
  });

  test("throws when the doc has no snapshot marker", () => {
    expect(() =>
      insertSnapshot("# no marker here", "2026-07-06", section),
    ).toThrow();
  });

  test("renders a trailing AI Overviews subsection when rows are passed", () => {
    const withOverview = renderSnapshotSection(
      "2026-07-06",
      ENGINES,
      [],
      "ran 1/1 queries via DataForSEO",
      [
        {
          index: 1,
          question: "Q1?",
          engine: "google-ai-overview",
          cited: true,
          excerpt: "caisson.sh mentioned",
        },
      ],
    );
    expect(withOverview).toContain("Google AI Overviews (DataForSEO)");
    expect(withOverview).toContain("caisson.sh mentioned");
  });

  test("omits the AI Overviews subsection when no rows are passed", () => {
    expect(section).not.toContain("Google AI Overviews");
  });
});

describe("findAiOverviewItem", () => {
  test("finds an ai_overview item nested inside a DataForSEO-shaped response", () => {
    const response = {
      tasks: [
        {
          result: [
            {
              items: [
                { type: "organic", title: "irrelevant" },
                { type: "ai_overview", items: [{ text: "Caisson is..." }] },
              ],
            },
          ],
        },
      ],
    };
    const found = findAiOverviewItem(response);
    expect(found).not.toBeNull();
    expect((found as { type: string }).type).toBe("ai_overview");
  });

  test("returns null when no ai_overview item is present", () => {
    expect(
      findAiOverviewItem({ tasks: [{ result: [{ items: [] }] }] }),
    ).toBeNull();
  });

  test("returns null for primitives / null input", () => {
    expect(findAiOverviewItem(null)).toBeNull();
    expect(findAiOverviewItem("string")).toBeNull();
    expect(findAiOverviewItem(42)).toBeNull();
  });
});
