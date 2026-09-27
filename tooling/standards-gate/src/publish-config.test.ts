// Publish-readiness invariants (ADR-0111), over the REAL packages/ tree: every manifested module
// that is not private publishes publicly to public npm, its manifest derives version+license from
// package.json (single source of truth, so checkManifestAgreement stays green through changeset
// bumps), and the published CLI ships dist and its runtime assets with a dist-pointing bin. What
// else a tarball may and may not carry is checked on the packed tarball (ADR-0429). Workspace IO —
// reads the on-disk tree, no synthetic input.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

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
  repository?: { type?: string; url?: string; directory?: string };
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

  test("manifest derives version+license from package.json (single source of truth)", () => {
    for (const p of pkgs) {
      // pj is the source; assert from the (possibly-undefined) pj side so a missing
      // version/license fails the test rather than tripping the type-checker.
      expect(p.pj.version).toBe(p.manifest.version);
      expect(p.pj.license).toBe(p.manifest.license);
    }
  });

  test("every published package publishes publicly to the public npm registry", () => {
    const off = published
      .filter(
        (p) =>
          p.pj.publishConfig?.access !== "public" ||
          p.pj.publishConfig.registry !== "https://registry.npmjs.org/",
      )
      .map((p) => p.pj.name);
    expect(off).toEqual([]);
  });

  // npm provenance rejects a publish whose repository.url does not match the publishing repo.
  test("every published package links its own source directory in the public repo", () => {
    const off = published
      .filter(
        (p) =>
          p.pj.repository?.url !==
            "git+https://github.com/GridWork-dev/caisson.git" ||
          p.pj.repository.directory !== `packages/${basename(p.dir)}`,
      )
      .map((p) => p.pj.name);
    expect(off).toEqual([]);
  });

  describe("@caisson-sh/cli (the npx bin, ADR-0092/0111)", () => {
    const cli = pkgs.find((p) => p.pj.name === "@caisson-sh/cli");

    test("exists in the publishable set", () => {
      expect(cli).toBeDefined();
    });

    test("bin points at the built dist entry, never src", () => {
      expect(cli?.pj.bin?.["create-caisson"]).toBe("./dist/cli.js");
    });

    test("files ships dist + the runtime assets the generator reads", () => {
      const files = cli?.pj.files ?? [];
      expect(files).toContain("dist");
      // The generator reads templates/ + registry-index.json at runtime via import.meta.url.
      expect(files).toContain("templates");
      expect(files).toContain("registry-index.json");
    });
  });
});
