import { describe, expect, test } from "bun:test";
import { competitorStateKeys, detectCompetitorChanges } from "./competitor.ts";

const URL = "https://competitor.example.com/pricing";

describe("detectCompetitorChanges", () => {
  test("first observation records a baseline, no finding", () => {
    const { findings, nextState } = detectCompetitorChanges(
      [{ url: URL, text: "v1" }],
      {},
    );
    expect(findings).toEqual([]);
    expect(Object.keys(nextState)).toHaveLength(1);
  });

  test("a content change against stored state emits a page_diff finding", () => {
    const baseline = detectCompetitorChanges(
      [{ url: URL, text: "v1" }],
      {},
    ).nextState;
    const { findings } = detectCompetitorChanges(
      [{ url: URL, text: "v2" }],
      baseline,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("page_diff");
    expect(findings[0]?.title).toContain("competitor.example.com");
  });

  test("no content change emits nothing", () => {
    const baseline = detectCompetitorChanges(
      [{ url: URL, text: "stable" }],
      {},
    ).nextState;
    const { findings } = detectCompetitorChanges(
      [{ url: URL, text: "stable" }],
      baseline,
    );
    expect(findings).toEqual([]);
  });
});

describe("competitorStateKeys", () => {
  test("produces one key per URL", () => {
    expect(
      competitorStateKeys([URL, "https://other.example.com"]),
    ).toHaveLength(2);
  });
});
