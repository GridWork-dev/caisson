// Data-lint for the module depth-page records (ADR-0237 F2): catalog bijection and artifacts
// that cite files which actually exist (true-to-built, ADR-0082).
import { describe, expect, test } from "bun:test";

import * as accessReview from "../../../packages/access-review/src/index.ts";
import * as riskRegister from "../../../packages/risk-register/src/index.ts";
import * as trustPage from "../../../packages/trust-page/src/index.ts";
import { generateStaticParams } from "../app/(marketing)/marketplace/modules/[slug]/page";
import { moduleSoftwareApplication } from "./jsonld";
import { MODULE_MARKS } from "./marks";
import { MODULE_PAGES, type ModulePageRecord } from "./module-pages";
import { MODULES } from "./catalog";

const COMPLETION_SLUGS = [
  "access-review",
  "risk-register",
  "trust-page",
] as const;
type CompletionSlug = (typeof COMPLETION_SLUGS)[number];

const COMPLETION_PACKAGE_EXPORTS: Readonly<
  Record<CompletionSlug, ReadonlySet<string>>
> = {
  "access-review": new Set(Object.keys(accessReview)),
  "risk-register": new Set(Object.keys(riskRegister)),
  "trust-page": new Set(Object.keys(trustPage)),
};

function completionRecord(slug: CompletionSlug): ModulePageRecord {
  const record = MODULE_PAGES.find((candidate) => candidate.slug === slug);
  if (record === undefined) {
    throw new Error(`missing completion-wave module page: ${slug}`);
  }
  return record;
}

function parityViolations(records: readonly ModulePageRecord[]): {
  missing: string[];
  orphans: string[];
} {
  const catalogIds = new Set(MODULES.map((module) => module.id));
  const recordIds = new Set(records.map((record) => record.slug));
  return {
    missing: [...catalogIds].filter((slug) => !recordIds.has(slug)).sort(),
    orphans: [...recordIds].filter((slug) => !catalogIds.has(slug)).sort(),
  };
}

describe("MODULE_PAGES (depth-page records)", () => {
  test("every catalog module has exactly one depth-page record (27/27 parity)", () => {
    const recordIds = MODULE_PAGES.map((record) => record.slug);
    expect(MODULES).toHaveLength(27);
    expect(MODULE_PAGES).toHaveLength(27);
    expect(new Set(recordIds).size).toBe(recordIds.length);
    expect(parityViolations(MODULE_PAGES)).toEqual({
      missing: [],
      orphans: [],
    });
  });

  test("the parity guard fails red when one catalog module loses its record", () => {
    const withoutTrustPage = MODULE_PAGES.filter(
      (record) => record.slug !== "trust-page",
    );
    expect(parityViolations(withoutTrustPage)).toEqual({
      missing: ["trust-page"],
      orphans: [],
    });
  });

  test("every record slug carries its own bespoke mark (ADR-0237 F6)", () => {
    for (const r of MODULE_PAGES) {
      expect(MODULE_MARKS[r.slug]).toBeDefined();
    }
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
    }
  });

  test("the OSCAL page names the real assessment-plan export, never the retired copy name", () => {
    const page = MODULE_PAGES.find((record) => record.slug === "oscal-spine");
    expect(page).toBeDefined();
    const copy = JSON.stringify(page);
    expect(copy).toContain("toOscalAssessmentPlan");
    expect(copy).not.toContain("buildOscalAssessmentPlan");
  });

  test("no record renders a price outside its code artifact", () => {
    for (const r of MODULE_PAGES) {
      const copy = JSON.stringify({ ...r, artifact: undefined });
      expect(`${r.slug}: ${copy.match(/\$\d[\d,]*/g)}`).toBe(`${r.slug}: null`);
    }
  });

  test("the three completion records match the depth-page content contract", async () => {
    for (const slug of COMPLETION_SLUGS) {
      const record = completionRecord(slug);
      const definitionWords = record.definition.trim().split(/\s+/).length;
      expect(
        definitionWords,
        `${slug}: definition must contain 40-70 words`,
      ).toBeGreaterThanOrEqual(40);
      expect(
        definitionWords,
        `${slug}: definition must contain 40-70 words`,
      ).toBeLessThanOrEqual(70);
      expect(record.included.length).toBeGreaterThanOrEqual(4);
      expect(record.included.length).toBeLessThanOrEqual(6);
      expect(record.artifact.annotations.length).toBeGreaterThanOrEqual(2);
      expect(record.artifact.annotations.length).toBeLessThanOrEqual(3);
      expect(record.faq.length).toBeGreaterThanOrEqual(3);

      const source = await Bun.file(
        new URL(`../../../${record.artifact.file}`, import.meta.url),
      ).text();
      expect(
        source.includes(record.artifact.code),
        `${slug}: artifact must be a verbatim package-source excerpt`,
      ).toBe(true);
    }
  });

  test("every new capability and annotation names a runtime export from its package", () => {
    for (const slug of COMPLETION_SLUGS) {
      const record = completionRecord(slug);
      const packageExports = COMPLETION_PACKAGE_EXPORTS[slug];
      const claims = [
        ...record.included.map((capability) => capability.body),
        ...record.artifact.annotations,
      ];
      for (const claim of claims) {
        const identifiers = [...packageExports].filter((identifier) =>
          claim.includes(identifier),
        );
        expect(
          identifiers.length,
          `${slug}: no package export named in claim "${claim}"`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test("the three completion records become static route params", () => {
    const params = generateStaticParams();
    for (const slug of COMPLETION_SLUGS) {
      expect(params).toContainEqual({ slug });
    }
  });

  test("the three completion routes emit Offer-free SoftwareApplication nodes with live URLs", () => {
    for (const slug of COMPLETION_SLUGS) {
      const record = completionRecord(slug);
      const mod = MODULES.find((candidate) => candidate.id === slug);
      if (mod === undefined) throw new Error(`missing catalog module: ${slug}`);
      const node = moduleSoftwareApplication(mod, {
        description: record.metaDescription,
      });
      expect(node["@type"]).toBe("SoftwareApplication");
      expect(node.url).toBe(`https://caisson.sh/marketplace/modules/${slug}`);
      expect("offers" in node).toBe(false);
    }
  });
});
