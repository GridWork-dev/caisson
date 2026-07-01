import { describe, expect, test } from "bun:test";

import { AUDIT_DOMAINS } from "./domains.ts";

describe("AUDIT_DOMAINS — the declared inventory (ADR-0134 §1)", () => {
  test("covers exactly the six ADR-0134 domains, each with globs + checkers", () => {
    const ids = AUDIT_DOMAINS.map((d) => d.id).sort();
    expect(ids).toEqual(
      [
        "design-ui",
        "evidence-compliance",
        "licensing-spdx",
        "rls-tenancy",
        "security",
        "standards-gate",
      ].sort(),
    );
    for (const d of AUDIT_DOMAINS) {
      expect(d.globs.length).toBeGreaterThan(0);
      expect(d.checkers.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  test("ids are unique", () => {
    const ids = AUDIT_DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
