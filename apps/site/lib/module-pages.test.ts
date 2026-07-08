// Data-lint for the module depth-page records (ADR-0237 F2) — the same class of pins the
// glossary records carry: catalog bijection, resolvable curated links, and artifacts that cite
// files which actually exist (true-to-built, ADR-0082).
import { describe, expect, test } from "bun:test";

import { GLOSSARY_TERMS } from "./glossary";
import { MODULE_MARKS } from "./marks";
import { MODULE_PAGES, type ModulePageRecord } from "./module-pages";
import { MODULE_PRICES } from "./pricing";

/** Flatten every prose string a record renders — the surface where an inclusion/composition claim
 *  could land. Excludes `artifact.code` (real package code, not a claim) and slugs/ids/labels. */
function proseStrings(r: ModulePageRecord): string[] {
  return [
    r.metaTitle,
    r.metaDescription,
    r.heroOneLiner,
    r.definition,
    ...r.included.flatMap((i) => [i.title, i.body]),
    ...r.faq.flatMap((f) => [f.question, f.answer]),
    r.sells.note,
  ];
}

describe("MODULE_PAGES (depth-page records)", () => {
  test("every depth-page record is a real sellable module (subset of the catalog)", () => {
    // Post-W6.2 the sellable catalog (MODULE_PRICES) is a superset: every module has a priced catalog
    // listing (ADR-0246 F1b), but only those with authored content have a depth page. The invariant
    // that must hold is no ORPHAN depth page — every record slug names a real sellable SKU (a depth
    // page for a product that doesn't exist would 404 its own catalog card link).
    const catalogIds = new Set(MODULE_PRICES.map((m) => m.id));
    const orphans = MODULE_PAGES.map((r) => r.slug).filter(
      (slug) => !catalogIds.has(slug),
    );
    expect(orphans).toEqual([]);
  });

  test("every record slug carries its own bespoke mark (ADR-0237 F6)", () => {
    for (const r of MODULE_PAGES) {
      expect(MODULE_MARKS[r.slug]).toBeDefined();
    }
  });

  test("every curated glossary link resolves to a shipped term", () => {
    const live = new Set(GLOSSARY_TERMS.map((t) => t.slug));
    const violations = MODULE_PAGES.flatMap((r) =>
      r.relatedGlossary
        .filter((slug) => !live.has(slug))
        .map((slug) => `${r.slug} -> ${slug}`),
    );
    expect(violations).toEqual([]);
  });

  test("every artifact cites a file that exists (true-to-built, ADR-0082)", async () => {
    const violations: string[] = [];
    for (const r of MODULE_PAGES) {
      const url = new URL(`../../../${r.artifact.file}`, import.meta.url);
      if (!(await Bun.file(url).exists())) {
        violations.push(`${r.slug}: ${r.artifact.file}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("records carry non-empty copy in every required field", () => {
    for (const r of MODULE_PAGES) {
      expect(r.metaTitle.length).toBeGreaterThan(0);
      expect(r.metaDescription.length).toBeGreaterThan(0);
      expect(r.heroOneLiner.length).toBeGreaterThan(0);
      expect(r.definition.length).toBeGreaterThan(0);
      expect(r.included.length).toBeGreaterThanOrEqual(3);
      expect(r.artifact.code.length).toBeGreaterThan(0);
      // SYNTHESIS §6 Tier-1 row 7: every module page carries an annotated snippet, not a bare dump.
      expect(r.artifact.annotations.length).toBeGreaterThanOrEqual(2);
      expect(r.faq.length).toBeGreaterThanOrEqual(2);
      expect(r.sells.note.length).toBeGreaterThan(0);
    }
  });

  test("no record claims the edition or bundle grants ai-evals (standalone-only)", () => {
    // The registry members map is the entitlement truth (see pricing.test.ts). The ai-evals
    // record itself must state standalone-ness; sibling records may NEVER name ai-evals/evals in
    // any prose field — a composition claim ("ships with the eval harness") would naturally land
    // in `included[].body` or `faq`, not just `sells.note`, so the lint scans every prose string.
    const aiEvals = MODULE_PAGES.find((r) => r.slug === "ai-evals");
    expect(aiEvals?.sells.note).toContain("no persona bundle includes it");
    for (const r of MODULE_PAGES) {
      if (r.slug === "ai-evals") continue;
      for (const text of proseStrings(r)) {
        expect(/\bai-evals\b|\bevals\b/i.test(text)).toBe(false);
      }
    }
  });
});
