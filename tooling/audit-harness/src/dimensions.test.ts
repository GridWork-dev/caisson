import { describe, expect, test } from "bun:test";

import {
  applicableDimensions,
  DIMENSIONS,
  dimension,
  type DimensionId,
} from "./dimensions.ts";
import { deriveDomains, type SurfaceClass } from "./domains.ts";

describe("DIMENSIONS — the eight fixed audit lenses (ADR-0233 task 2; D8 added by ADR-0411)", () => {
  test("exactly D1..D8, unique ids, each with a checker + hunts", () => {
    const ids = DIMENSIONS.map((d) => d.id);
    expect(ids).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DIMENSIONS) {
      expect(d.checker.length).toBeGreaterThan(0);
      expect(d.hunts.length).toBeGreaterThan(0);
      expect(d.slug.length).toBeGreaterThan(0);
    }
  });

  test("dimension() looks up by id and throws on an unknown id", () => {
    expect(dimension("D3").slug).toBe("customer-facing-quality");
    expect(() => dimension("D99" as DimensionId)).toThrow(/unknown dimension/);
  });

  test("D7's checker matches the SPEC runbook lane (haiku recon + standards-gate, not gw-code-reviewer)", () => {
    expect(dimension("D7").checker).toBe("haiku recon + standards-gate");
  });

  test("D8 routes to the design lane — the retired design-critic's lens, not a reviewer's (ADR-0411)", () => {
    expect(dimension("D8").slug).toBe("visual-quality");
    expect(dimension("D8").checker).toBe("gw-frontend-designer");
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

  test("oss-source = {D1..D7} — every SOURCE lens applies, but not the rendered-surface one", () => {
    const oss = new Set(applicableDimensions("oss-source", "packages/kernel"));
    for (const id of ["D1", "D2", "D3", "D4", "D5", "D6", "D7"] as const) {
      expect(oss.has(id)).toBe(true);
    }
    // D8 grades a rendered surface; a package tree has nothing to render (ADR-0411).
    expect(oss.has("D8")).toBe(false);
    expect(
      applicableDimensions("sold-source", "packages/field-crypto"),
    ).not.toContain("D8");
  });

  test("buyer-runtime has the buyer lenses but not the package-only license lens (D5)", () => {
    const set = new Set(applicableDimensions("buyer-runtime"));
    expect(set.has("D3")).toBe(true); // customer-facing
    expect(set.has("D6")).toBe(true); // docs-vs-code
    expect(set.has("D5")).toBe(false); // not a distributed package
  });

  test("D8 keys on the DOMAIN (apps/*), not the class — it crosses the class line both ways (ADR-0411)", () => {
    // apps/site + apps/demos are buyer-runtime; apps/admin is internal-only (domains.ts classifies
    // the operator control-plane that way) — but all three are rendered UIs, so all three carry D8.
    expect(applicableDimensions("buyer-runtime", "apps/site")).toContain("D8");
    expect(applicableDimensions("buyer-runtime", "apps/demos")).toContain("D8");
    expect(applicableDimensions("internal-only", "apps/admin")).toContain("D8");
    // services/* would be buyer-runtime backend APIs with nothing to render — a class-keyed D8
    // would manufacture dead cells there. The open-source pivot retired every services/* dir, so
    // deriveDomains yields none; a hypothetical one still carries no D8.
    const services = deriveDomains()
      .filter((d) => d.id.startsWith("services/"))
      .map((d) => d.id);
    expect(services).toEqual([]);
    expect(applicableDimensions("buyer-runtime", "services/api")).not.toContain(
      "D8",
    );
    // No package tree, no tooling dir, and no bare call picks it up.
    expect(
      applicableDimensions("internal-only", "packages/license-issue"),
    ).not.toContain("D8");
    expect(
      applicableDimensions("internal-only", "tooling/audit-harness"),
    ).not.toContain("D8");
    for (const c of classes)
      expect(applicableDimensions(c)).not.toContain("D8");
  });

  test("D8 is never the only lens a domain carries — apps/* keeps its full base set", () => {
    expect(applicableDimensions("internal-only", "apps/admin")).toEqual([
      "D1",
      "D2",
      "D6",
      "D7",
      "D8",
    ]);
    expect(applicableDimensions("buyer-runtime", "apps/site")).toEqual([
      "D1",
      "D2",
      "D3",
      "D4",
      "D6",
      "D7",
      "D8",
    ]);
  });

  test("internal-only carries no buyer-facing lens (no D3/D4 — nothing ships)", () => {
    const set = new Set(applicableDimensions("internal-only"));
    expect(set.has("D3")).toBe(false);
    expect(set.has("D4")).toBe(false);
    expect(set.has("D1")).toBe(true); // still security-floored
  });

  test("D5 (license-tier) applies only to internal-only PACKAGES, never a bare internal-only domain — no dead cells", () => {
    // An internal-only package is still a real package with a license surface to check.
    expect(
      applicableDimensions("internal-only", "packages/license-issue"),
    ).toContain("D5");
    // A workflow yaml, a tooling package, or a root doc has no sold-package tier to be wrong about.
    expect(
      applicableDimensions("internal-only", "tooling/audit-harness"),
    ).not.toContain("D5");
    expect(applicableDimensions("internal-only", "workflows")).not.toContain(
      "D5",
    );
    expect(
      applicableDimensions("internal-only", "tools/security"),
    ).not.toContain("D5");
    expect(applicableDimensions("internal-only", "root-docs")).not.toContain(
      "D5",
    );
    // No domainId supplied → conservatively non-package (the pre-existing call shape).
    expect(applicableDimensions("internal-only")).not.toContain("D5");
  });
});
