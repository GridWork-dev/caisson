import { describe, expect, test } from "bun:test";

import {
  BASE_CAPABILITIES,
  BASE_PACKAGES,
  baseSubstrateList,
} from "./base-substrate";
import { MODULE_PRICES } from "./pricing";

// The honesty guard for the open-base SOT. The bug this exists to prevent: a prose list once
// claimed `credits` (a paid $149 module) was part of the free Apache-2.0 base. If any commercial
// SKU re-enters BASE_PACKAGES, test 1 fails before it can ship.
describe("base substrate SOT", () => {
  test("no base package is a commercial SKU", () => {
    const commercial = new Set(MODULE_PRICES.map((m) => m.id));
    for (const p of BASE_PACKAGES) {
      expect(commercial.has(p)).toBe(false);
    }
  });

  test("every capability tile names only real base packages", () => {
    const base = new Set<string>(BASE_PACKAGES);
    for (const c of BASE_CAPABILITIES) {
      for (const p of c.packages) {
        expect(base.has(p)).toBe(true);
      }
    }
  });

  test("the capability tiles partition every base package exactly once", () => {
    const covered = BASE_CAPABILITIES.flatMap((c) => c.packages).sort();
    expect(covered).toEqual([...BASE_PACKAGES].sort());
  });

  test("the substrate prose list drops credits and keeps rate-limit", () => {
    expect(baseSubstrateList()).not.toContain("credits");
    expect(baseSubstrateList()).toContain("rate-limit");
  });
});
