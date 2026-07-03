// Data-lint for the module depth-page records (ADR-0237 F2) — the same class of pins the
// glossary records carry: catalog bijection, resolvable curated links, and artifacts that cite
// files which actually exist (true-to-built, ADR-0082).
import { describe, expect, test } from "bun:test";

import { GLOSSARY_TERMS } from "./glossary";
import { MODULE_MARKS } from "./marks";
import { MODULE_PAGES } from "./module-pages";
import { MODULE_PRICES } from "./pricing";

describe("MODULE_PAGES (depth-page records)", () => {
  test("records are a bijection with the sellable catalog", () => {
    const recordSlugs = MODULE_PAGES.map((r) => r.slug).sort();
    const catalogIds = MODULE_PRICES.map((m) => m.id).sort();
    expect(recordSlugs).toEqual(catalogIds);
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
      expect(r.faq.length).toBeGreaterThanOrEqual(2);
      expect(r.sells.note.length).toBeGreaterThan(0);
    }
  });

  test("no record claims the edition or bundle grants ai-evals (standalone-only)", () => {
    // The registry members map is the entitlement truth (see pricing.test.ts). The ai-evals
    // record itself must state standalone-ness; sibling records may name ai-evals only OUTSIDE
    // an edition/bundle inclusion list.
    const aiEvals = MODULE_PAGES.find((r) => r.slug === "ai-evals");
    expect(aiEvals?.sells.note).toContain("no edition includes it");
    for (const r of MODULE_PAGES) {
      if (r.slug === "ai-evals") continue;
      expect(/\bai-evals\b|\bevals\b/i.test(r.sells.note)).toBe(false);
    }
  });
});
