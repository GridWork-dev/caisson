import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { exportRegimeCrosswalk } from "./regime-crosswalk.ts";
import { nist80053Crosswalk } from "./nist-800-53.ts";
import { loadVendoredNistControlIds } from "../vendor/nist-catalog-controls.ts";

const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

describe("nist80053Crosswalk", () => {
  test("exports byte-stably from the oscal-spine golden directory", () => {
    matchGolden(
      PKG_SRC_META,
      "crosswalk-nist-800-53",
      exportRegimeCrosswalk(nist80053Crosswalk),
    );
  });

  test("every row is maps-to and carries NIST IR 8278A relationship vocabulary", () => {
    const relationships = new Set([
      "subset-of",
      "intersects-with",
      "equal",
      "superset-of",
      "not-related-to",
    ]);
    const rationales = new Set(["syntactic", "semantic", "functional"]);
    for (const row of nist80053Crosswalk.rows) {
      expect(row.claim).toBe("maps-to");
      expect(row.canonicalControlId).toBeDefined();
      expect(relationships.has(row.relationship ?? "")).toBe(true);
      expect(rationales.has(row.rationale ?? "")).toBe(true);
      if (row.strength !== undefined) {
        expect(row.strength).toBeGreaterThanOrEqual(0);
        expect(row.strength).toBeLessThanOrEqual(10);
      }
    }
  });

  test("pins the vendored catalog as its seed provenance", () => {
    expect(nist80053Crosswalk.seedProvenance?.sourceDigest).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(nist80053Crosswalk.seedProvenance?.sourceUrl).toMatch(/^https:\/\//);
  });

  const vendoredIds = loadVendoredNistControlIds();
  for (const row of nist80053Crosswalk.rows) {
    test(`${row.control} exists in the vendored NIST SP 800-53 rev5 catalog`, () => {
      expect(vendoredIds.has(row.control.toUpperCase())).toBe(true);
    });
  }
});
