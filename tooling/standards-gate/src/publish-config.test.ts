// Publish-readiness invariants (ADR-0111), over the REAL packages/ tree: every manifested module
// that is not private declares a publishConfig, its manifest derives version+license from
// package.json (single source of truth, so checkManifestAgreement stays green through changeset
// bumps), and the published CLI ships dist (never src) with a dist-pointing bin. Workspace IO —
// reads the on-disk tree, no synthetic input.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const PKGS = join(ROOT, "packages");

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
  manifest: { version: string; license: string };
}

/** Every packages/* with a manifest — the module set (ADR-0111). */
async function loadModules(): Promise<Publishable[]> {
  const out: Publishable[] = [];
  for (const name of readdirSync(PKGS).sort()) {
    const dir = join(PKGS, name);
    const pjPath = join(dir, "package.json");
    const mfPath = join(dir, "manifest.ts");
    if (!existsSync(pjPath) || !existsSync(mfPath)) continue;
    const pj = JSON.parse(readFileSync(pjPath, "utf8")) as PkgJson;
    const manifest = (await import(mfPath)).default as Publishable["manifest"];
    out.push({ dir, pj, manifest });
  }
  return out;
}

const pkgs = await loadModules();

// A `private: true` package is NEVER published (npm refuses it). The publish invariants below apply
// to the PUBLISHED set; the never-published set gets its own inverse guard.
const published = pkgs.filter((p) => p.pj.private !== true);
const neverPublished = pkgs.filter((p) => p.pj.private === true);

describe("publish readiness (ADR-0111)", () => {
  test("the workspace has the expected publishable surface", () => {
    expect(published.length).toBeGreaterThanOrEqual(20);
  });

  test("a never-published package leaks no publishConfig (no registry target)", () => {
    const leaked = neverPublished
      .filter((p) => p.pj.publishConfig !== undefined)
      .map((p) => p.pj.name);
    expect(leaked).toEqual([]);
  });

  test("every published package's version has a matching ledger entry (version-commit gap guard)", () => {
    // A published package.json version must exist as a ledger entry, so a hand-bumped version (or
    // a consume whose ledger append failed) fails loudly. A DELISTED id is exempt permanently:
    // delisting is terminal (ADR-0271), so a dependency-cascade bump on one can never gain a
    // ledger row.
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

  test("every published package declares a publishConfig", () => {
    const missing = published
      .filter((p) => p.pj.publishConfig === undefined)
      .map((p) => p.pj.name);
    expect(missing).toEqual([]);
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
