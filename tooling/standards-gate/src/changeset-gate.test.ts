// Changeset-presence gate wiring (ADR-0021/0111). Now that packages are public (0.1.0), a PR that
// changes a publishable package without a changeset must fail CI, and the gate runs on pull requests
// only (a main push has no base to diff; main is the merge target). The gate itself is `changeset status
// --since=origin/main` (exits 1 with changed packages but no changeset). This test pins the WIRING so
// an accidental removal of the step — or the PR-only condition, or the fetch-depth needed to resolve
// origin/main — is caught. Text-level assertions over the committed CI + changeset config.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const CI = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");

describe("changeset-presence gate (ADR-0021/0111)", () => {
  test("CI runs `changeset status --since=origin/main`", () => {
    expect(CI).toContain("changeset status --since=origin/main");
  });

  test("the gate runs on pull requests only (skipped on main pushes and dispatches)", () => {
    expect(CI).toMatch(/if:\s*github\.event_name\s*==\s*'pull_request'/);
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

  test("the changeset config the gate runs against is present", () => {
    // The original seed-changeset assertion expired at the first release: `changeset version`
    // consumes every pending .md by design (ADR-0208 republish), so an empty .changeset/ dir is
    // the normal post-release state. What must never disappear is the config the gate runs with.
    expect(existsSync(join(ROOT, ".changeset", "config.json"))).toBe(true);
  });

  test("the gate skips release PRs (changesets consumed since origin/main)", () => {
    // ADR-0208: a PR that deletes changeset files IS the release PR — its package.json bumps are
    // the consume output, not uncovered package changes. Pin the diff-filter guard so the
    // exemption is not accidentally dropped from the CI step.
    expect(CI).toContain(
      "--diff-filter=D origin/main...HEAD -- '.changeset/*.md'",
    );
  });
});
