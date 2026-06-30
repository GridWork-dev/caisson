// Changeset-presence gate wiring (ADR-0021/0111). Now that packages are public (0.1.0), a PR that
// changes a publishable package without a changeset must fail CI, and the gate must be skipped on the
// main branch (no base to diff; main is the merge target). The gate itself is `changeset status
// --since=origin/main` (exits 1 with changed packages but no changeset). This test pins the WIRING so
// an accidental removal of the step — or the main-skip, or the fetch-depth needed to resolve
// origin/main — is caught. Text-level assertions over the committed CI + changeset config.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const CI = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");

describe("changeset-presence gate (ADR-0021/0111)", () => {
  test("CI runs `changeset status --since=origin/main`", () => {
    expect(CI).toContain("changeset status --since=origin/main");
  });

  test("the gate is skipped on the main branch", () => {
    // The step carries a main-skip condition (it is a PR-only gate).
    expect(CI).toMatch(/if:\s*github\.ref\s*!=\s*'refs\/heads\/main'/);
  });

  test("the standards-gate checkout fetches full history so origin/main resolves", () => {
    expect(CI).toContain("fetch-depth: 0");
  });

  test("changeset config constrains internal-dependency bumping to patch (ADR-0021)", () => {
    // changesets' `updateInternalDependencies` only accepts 'patch' | 'minor' (a boolean `false` is a
    // config ValidationError). 'patch' is the conservative floor: an internal dependent of a bumped
    // package gets at most a patch bump, never a spurious minor.
    const cfg = JSON.parse(
      readFileSync(join(ROOT, ".changeset", "config.json"), "utf8"),
    ) as { updateInternalDependencies?: string };
    expect(cfg.updateInternalDependencies).toBe("patch");
  });

  test("an initial release changeset is present to seed the gate", () => {
    const dir = join(ROOT, ".changeset");
    const seeds = readdirSync(dir).filter(
      (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
    );
    expect(seeds.length).toBeGreaterThanOrEqual(1);
    expect(existsSync(dir)).toBe(true);
  });
});
