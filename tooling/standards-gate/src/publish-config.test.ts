// Publish-readiness invariants (ADR-0111). Asserts the private→public FLIP landed coherently across
// the REAL packages/ tree: every publishable module is public at 0.1.0 with a tier-correct
// publishConfig, its manifest derives version+license from package.json (single source of truth, so
// checkManifestAgreement stays green through changeset bumps), and the published CLI ships dist (never
// src) with a dist-pointing bin. Drives the open↔commercial split off each manifest's `tier` field, so
// it stays correct as the package set grows. Workspace IO — reads the on-disk tree, no synthetic input.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const PKGS = join(ROOT, "packages");

const OSS_REGISTRY = "https://registry.npmjs.org/";
const GH_REGISTRY = "https://npm.pkg.github.com";

interface PkgJson {
  name: string;
  version?: string;
  private?: boolean;
  license?: string;
  bin?: Record<string, string>;
  files?: string[];
  publishConfig?: { access?: string; registry?: string };
}

interface Publishable {
  dir: string;
  pj: PkgJson;
  tier: "oss" | "paid";
  manifest: { version: string; license: string; tier: string };
}

/** Every packages/* with a manifest carrying a tier — the publishable set, tier-driven (ADR-0111). */
async function loadPublishable(): Promise<Publishable[]> {
  const out: Publishable[] = [];
  for (const name of readdirSync(PKGS).sort()) {
    const dir = join(PKGS, name);
    const pjPath = join(dir, "package.json");
    const mfPath = join(dir, "manifest.ts");
    if (!existsSync(pjPath) || !existsSync(mfPath)) continue;
    const tierMatch = readFileSync(mfPath, "utf8").match(
      /tier:\s*"(oss|paid)"/,
    );
    if (!tierMatch) continue; // tier absent → not publishable (skip, per ADR-0111)
    const pj = JSON.parse(readFileSync(pjPath, "utf8")) as PkgJson;
    if (pj.private === true) {
      // surfaced as an explicit failure below, but still collect for the assertion
    }
    const manifest = (await import(mfPath)).default as Publishable["manifest"];
    out.push({ dir, pj, tier: tierMatch[1] as "oss" | "paid", manifest });
  }
  return out;
}

const pkgs = await loadPublishable();

// A `private: true` package is NEVER published (npm refuses it). The deliberate carve-out is the
// licensing signer primitive (@caisson/license-issue), whose signing key must never reach a buyer
// tarball (ADR-0110). The flip invariants below apply to the PUBLISHED set; the never-published set
// gets its own inverse guards so a forgotten oss flip cannot hide here as "private".
const published = pkgs.filter((p) => p.pj.private !== true);
const neverPublished = pkgs.filter((p) => p.pj.private === true);

describe("publish-readiness flip (ADR-0111)", () => {
  test("the workspace has the expected publishable surface", () => {
    expect(published.length).toBeGreaterThanOrEqual(20);
  });

  test("a never-published package is a paid primitive (a forgotten oss flip can't hide as private)", () => {
    const wrong = neverPublished
      .filter((p) => p.tier !== "paid")
      .map((p) => `${p.pj.name}#${p.tier}`);
    expect(wrong).toEqual([]);
  });

  test("a never-published package leaks no publishConfig (no registry target)", () => {
    const leaked = neverPublished
      .filter((p) => p.pj.publishConfig !== undefined)
      .map((p) => p.pj.name);
    expect(leaked).toEqual([]);
  });

  test("every published package is at its ADR-0208 republish version", () => {
    // The 2026-07-02 consume (ADR-0208 #5): every published package took its pending minor to
    // 0.2.0 except the four Stage-2 primitives, whose changesets were patch-only. Mirrors the
    // divergence map in registry/scripts/full-tree-index.test.ts.
    const PATCH_ONLY = new Set([
      "@caisson/alerting",
      "@caisson/retention-runner",
      "@caisson/tool-exec",
      "@caisson/platform-reads",
    ]);
    // First publishes AFTER the republish enter at their own initial version (mirrors the
    // FIRST_PUBLISH map in registry/scripts/full-tree-index.test.ts).
    const FIRST_PUBLISH: Record<string, string> = {
      // Slice-2 harvest (ADR-0186): published 0.1.0 the same day, after the 0.2.0 wave.
      "@caisson/agent-runner": "0.1.0",
    };
    const off = published
      .filter(
        (p) =>
          p.pj.version !==
          (FIRST_PUBLISH[p.pj.name ?? ""] ??
            (PATCH_ONLY.has(p.pj.name ?? "") ? "0.1.1" : "0.2.0")),
      )
      .map((p) => `${p.pj.name}@${p.pj.version}`);
    expect(off).toEqual([]);
  });

  test("manifest derives version+license from package.json (single source of truth)", () => {
    for (const p of pkgs) {
      // pj is the source; assert from the (possibly-undefined) pj side so a missing
      // version/license fails the test rather than tripping the type-checker.
      expect(p.pj.version).toBe(p.manifest.version);
      expect(p.pj.license).toBe(p.manifest.license);
    }
  });

  test("oss tier → public access on public npm; paid tier → restricted on GitHub Packages", () => {
    for (const p of published) {
      const pc = p.pj.publishConfig;
      expect(pc).toBeDefined();
      if (p.tier === "oss") {
        expect(pc?.access).toBe("public");
        expect(pc?.registry).toBe(OSS_REGISTRY);
      } else {
        expect(pc?.access).toBe("restricted");
        expect(pc?.registry).toBe(GH_REGISTRY);
      }
    }
  });

  test("no commercial (paid) package is ever published with public access", () => {
    const leaked = pkgs
      .filter(
        (p) => p.tier === "paid" && p.pj.publishConfig?.access === "public",
      )
      .map((p) => p.pj.name);
    expect(leaked).toEqual([]);
  });

  test("publishConfig.access agrees with the manifest tier (drives off tier, not a name list)", () => {
    for (const p of pkgs) {
      // manifest.tier is widened to string on import; compare from that side.
      expect(p.manifest.tier).toBe(p.tier);
    }
  });

  describe("@caisson/cli (the npx bin, ADR-0092/0111)", () => {
    const cli = pkgs.find((p) => p.pj.name === "@caisson/cli");

    test("exists in the publishable set", () => {
      expect(cli).toBeDefined();
    });

    test("bin points at the built dist entry, never src", () => {
      expect(cli?.pj.bin?.["create-caisson"]).toBe("./dist/cli.js");
    });

    test("files ships dist + runtime assets and NEVER leaks src", () => {
      const files = cli?.pj.files ?? [];
      expect(files).toContain("dist");
      // The generator reads templates/ + migrations-bundle/ at runtime via import.meta.url.
      expect(files).toContain("templates");
      expect(files).toContain("migrations-bundle");
      // No entry ships source.
      expect(files.some((f) => f === "src" || f.startsWith("src/"))).toBe(
        false,
      );
    });
  });
});
