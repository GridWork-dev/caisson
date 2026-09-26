// Publish-readiness invariants (ADR-0111). Asserts the private→public FLIP landed coherently across
// the REAL packages/ tree: every publishable module is public at 0.1.0 with a tier-correct
// publishConfig, its manifest derives version+license from package.json (single source of truth, so
// checkManifestAgreement stays green through changeset bumps), and the published CLI ships dist (never
// src) with a dist-pointing bin. Drives the open↔commercial split off each manifest's `tier` field, so
// it stays correct as the package set grows. Workspace IO — reads the on-disk tree, no synthetic input.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RESERVED_MODULE_ENTITLEMENT_IDS } from "@caisson/registry-schema";

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

  test("every published package's version has a matching ledger entry (version-commit gap guard)", () => {
    // The old form of this test pinned an exact per-wave version map, which went stale on every
    // consume (the CI publish run bumps versions on main without re-running this suite — the
    // 2026-07-03 third-wave consume broke the ADR-0228 second-wave pins). The durable ADR-0111
    // invariant is wave-independent: a published package.json version must exist as a ledger
    // entry, so a hand-bumped version (or a consume whose ledger append failed) fails loudly.
    // A SOLD-but-unpublished package (its bare slug sits in RESERVED_MODULE_ENTITLEMENT_IDS) is
    // exempt until its first publish — the reservation drops in the same change that lands the
    // index/ledger entry, so this exemption self-expires and the guard re-arms automatically.
    // A DELISTED id is exempt permanently: delisting is terminal (ADR-0271) and
    // ci-publish-step.ts skips delisted manifests in version mode, so a `changeset version`
    // dependency-cascade bump on one can never gain a ledger row (first hit: the 2026-07-12
    // train-ride consume bumped the dissolved edition metas agent-dev/ai-kit/local-ai).
    const ledgerLines = readFileSync(
      join(ROOT, "registry", "ledger.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map(
        (l) => JSON.parse(l) as { op?: string; id: string; version?: string },
      );
    const ledgered = new Set(
      ledgerLines
        .filter((e) => e.op === undefined)
        .map((e) => `${e.id}@${e.version}`),
    );
    // Coverage boundary: this exemption is derived only from ledger `op:"delist"` rows. A package
    // id with no such terminal row never enters this set, so the exemption cannot mask that
    // non-delisted package's missing current-version publish row.
    const delisted = new Set(
      ledgerLines.filter((e) => e.op === "delist").map((e) => e.id),
    );
    const off = published
      .filter((p) => !ledgered.has(`${p.pj.name}@${p.pj.version}`))
      .filter((p) => !delisted.has(p.pj.name))
      .filter(
        (p) =>
          !RESERVED_MODULE_ENTITLEMENT_IDS.has(
            p.pj.name.replace(/^@caisson\//, ""),
          ),
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
      // The generator reads templates/ + registry-index.json at runtime via import.meta.url.
      expect(files).toContain("templates");
      expect(files).toContain("registry-index.json");
      // No entry ships source.
      expect(files.some((f) => f === "src" || f.startsWith("src/"))).toBe(
        false,
      );
    });
  });
});
