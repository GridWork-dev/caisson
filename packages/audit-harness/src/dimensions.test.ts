import { describe, expect, test } from "bun:test";

import {
  applicableDimensions,
  DIMENSIONS,
  dimension,
  type DimensionId,
} from "./dimensions.ts";
import type { SurfaceClass } from "./domains.ts";

describe("DIMENSIONS — the seven fixed audit lenses (ADR-0233, task 2)", () => {
  test("exactly D1..D7, unique ids, each with a checker + hunts", () => {
    const ids = DIMENSIONS.map((d) => d.id);
    expect(ids).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7"]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DIMENSIONS) {
      expect(d.checker.length).toBeGreaterThan(0);
      expect(d.hunts.length).toBeGreaterThan(0);
      expect(d.slug.length).toBeGreaterThan(0);
    }
  });

  test("dimension() looks up by id and throws on an unknown id", () => {
    expect(dimension("D3").slug).toBe("customer-facing-quality");
    expect(() => dimension("D9" as DimensionId)).toThrow(/unknown dimension/);
  });
});

describe("applicableDimensions — the sparse class → lens matrix", () => {
  const classes: SurfaceClass[] = [
    "oss-source",
    "sold-source",
    "buyer-runtime",
    "internal-only",
  ];

  test("every surface class resolves to a NON-EMPTY applicable set", () => {
    for (const c of classes) {
      expect(applicableDimensions(c).length).toBeGreaterThan(0);
    }
  });

  test("oss-source ⊇ {D1..D7} (buyers read the source — every lens applies)", () => {
    const oss = new Set(applicableDimensions("oss-source"));
    for (const id of ["D1", "D2", "D3", "D4", "D5", "D6", "D7"] as const) {
      expect(oss.has(id)).toBe(true);
    }
  });

  test("buyer-runtime has the buyer lenses but not the package-only license lens (D5)", () => {
    const set = new Set(applicableDimensions("buyer-runtime"));
    expect(set.has("D3")).toBe(true); // customer-facing
    expect(set.has("D6")).toBe(true); // docs-vs-code
    expect(set.has("D5")).toBe(false); // not a distributed package
  });

  test("internal-only carries no buyer-facing lens (no D3/D4 — nothing ships)", () => {
    const set = new Set(applicableDimensions("internal-only"));
    expect(set.has("D3")).toBe(false);
    expect(set.has("D4")).toBe(false);
    expect(set.has("D1")).toBe(true); // still security-floored
  });
});
