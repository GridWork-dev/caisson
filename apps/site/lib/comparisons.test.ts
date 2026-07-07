import { test, expect, describe } from "bun:test";

import { ACCESSED, COMPARISONS, findComparison } from "./comparisons";

// The comparison records ARE the /compare/[slug] pages (generateStaticParams + the sitemap derive
// from them). These invariants guard the honesty floor (ADR-0080) and the spoke wiring: a typo'd
// slug is a 404, a missing accessed date is an unstamped claim, an empty faq is a missing FAQPage.

// The full 20-target slug list from docs/gtm/comparison-targets.md: Group A boilerplates + the free
// create-t3-app scaffold, Group B compliance-automation (GRC) platforms, and Group C build-in-house.
const EXPECTED_SLUGS = [
  // Group A — SaaS boilerplates / starter kits
  "shipfast",
  "makerkit",
  "supastarter",
  "saas-pegasus",
  "turbostarter",
  "open-saas",
  "bedrock",
  "shipixen",
  "saasrock",
  "divjoy",
  "create-t3-app",
  // Group B — compliance-automation (GRC) platforms
  "vanta",
  "drata",
  "secureframe",
  "sprinto",
  "scytale",
  "thoropass",
  "delve",
  "comp-ai",
  // Group C — build in-house
  "build-in-house",
] as const;

describe("COMPARISONS registry", () => {
  test("covers exactly the twenty comparison targets", () => {
    expect(COMPARISONS.map((c) => c.slug).sort()).toEqual(
      [...EXPECTED_SLUGS].sort(),
    );
  });

  test("slugs are unique", () => {
    const slugs = COMPARISONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("findComparison resolves every slug and rejects unknowns", () => {
    for (const c of COMPARISONS) {
      expect(findComparison(c.slug)?.competitor).toBe(c.competitor);
    }
    expect(findComparison("does-not-exist")).toBeUndefined();
  });

  test("ACCESSED is an ISO date the pages stamp on every scraped claim", () => {
    expect(ACCESSED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("every competitor URL is https (never auto-prepended, ADR security floor)", () => {
    for (const c of COMPARISONS) {
      expect(new URL(c.competitorUrl).protocol).toBe("https:");
    }
  });

  test("meta titles use the 'Caisson vs X' shape", () => {
    for (const c of COMPARISONS) {
      expect(c.metaTitle).toBe(`Caisson vs ${c.competitor}`);
    }
  });

  test("each record carries the required page substance", () => {
    for (const c of COMPARISONS) {
      // Answer capsule (top-30% requirement) — real prose, not a stub.
      expect(c.answer.length).toBeGreaterThan(80);
      expect(c.heroLede.length).toBeGreaterThan(20);
      // A real comparison table.
      expect(c.rows.length).toBeGreaterThanOrEqual(6);
      for (const r of c.rows) expect(r.label.length).toBeGreaterThan(0);
      // Credibility law — the competitor's genuine strengths stay in.
      expect(c.competitorStrengths.length).toBeGreaterThanOrEqual(2);
      expect(c.caissonLine.length).toBeGreaterThanOrEqual(2);
      // Dated, scraped facts.
      expect(c.competitorFacts.length).toBeGreaterThanOrEqual(3);
      expect(c.competitorPrice.length).toBeGreaterThan(0);
      // FAQPage needs real questions.
      expect(c.faq.length).toBeGreaterThanOrEqual(3);
      for (const f of c.faq) {
        expect(f.question.length).toBeGreaterThan(0);
        expect(f.answer.length).toBeGreaterThan(40);
      }
      // Honest "how to choose" trichotomy.
      expect(c.whenPickCompetitor.length).toBeGreaterThan(0);
      expect(c.whenPickCaisson.length).toBeGreaterThan(0);
      expect(c.whenBoth.length).toBeGreaterThan(0);
    }
  });
});
