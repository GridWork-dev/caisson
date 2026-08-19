import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  BASE_CAPABILITIES,
  BASE_PACKAGES,
  baseSubstrateList,
} from "./base-substrate";
import { MODULE_PRICES } from "./pricing";

// The honesty guard for the open-base SOT. The bug this exists to prevent: a prose list once
// claimed `credits` (a paid $149 module) was part of the free Apache-2.0 base. The binding truth is
// the SPDX `license` field in each package's package.json — so assert that directly (a commercial
// package that is NOT a sellable module, e.g. provenance/everything/brand, would pass the
// MODULE_PRICES check but fail this one). apps/site/lib -> repo root is three levels up.
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
describe("base substrate SOT", () => {
  test("every base package is SPDX Apache-2.0 on disk", () => {
    for (const p of BASE_PACKAGES) {
      const pkg = JSON.parse(
        readFileSync(join(REPO_ROOT, "packages", p, "package.json"), "utf8"),
      ) as { license?: string };
      expect(pkg.license).toBe("Apache-2.0");
    }
  });

  // THE CONVERSE, and the one that was missing (ADR-0412). Every test above asserts
  // BASE_PACKAGES ⊆ Apache-on-disk — that the list names nothing it shouldn't. None asserted
  // Apache-on-disk ⊆ BASE_PACKAGES, so a package could be published Apache-2.0, served anonymously
  // by the registry, and simply never named on the public license page, with every gate green.
  // That is exactly what happened: counsel flagged "the site says 15, the registry exposes 16",
  // ADR-0410 retired @caisson/analytics, and @caisson/ds-manifest silently took its place in the
  // gap without a single test noticing. "Shipped but unnamed" is the misrepresentation direction
  // that matters legally — this is the assertion that makes it a red CI run instead of a finding.
  test("every Apache-2.0 package on disk IS named in BASE_PACKAGES — no shipped-but-unnamed", () => {
    const named = new Set<string>(BASE_PACKAGES);
    const apacheOnDisk = readdirSync(join(REPO_ROOT, "packages"), {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => {
        const manifest = join(REPO_ROOT, "packages", name, "package.json");
        if (!existsSync(manifest)) return false;
        const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
          license?: string;
        };
        return pkg.license === "Apache-2.0";
      });
    // Guard the guard: an empty scan would make this vacuously green.
    expect(apacheOnDisk.length).toBeGreaterThan(10);
    expect(apacheOnDisk.filter((name) => !named.has(name))).toEqual([]);
  });

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
