import { execFileSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { deriveDomains, domainForPath } from "./domains.ts";

// The mechanical coverage GATE (ADR-0233 / SPEC audit-harness-v2, task 1). v1 scanned an
// AUDITED_ROOTS ALLOW-list — a new top-level dir (tools/, a root doc) escaped it silently, and so
// would any dir added tomorrow. v2 flips to a DENY-list scan: enumerate EVERY git-tracked file in
// the repo (`git ls-files`), subtract the reviewed IGNORE set below, and require every remainder
// to resolve to exactly one domain. Add a throwaway `packages/zzz-probe/` (no package.json) →
// `deriveDomains(REPO_ROOT)` throws; add a new top-level dir with no IGNORE entry and no domain →
// the second test below fails, naming the offender.

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

// Vendor / build output — never a git-tracked path in practice, kept as a defensive filter.
const BUILD_OUTPUT = /(^|\/)(node_modules|dist|\.next|\.turbo|coverage)(\/|$)/;

/**
 * The reviewed IGNORE set (ADR-0233 fix). Every entry is process-exhaust, generated data, or
 * build/lint config with no audit-relevant content — each justified below. This is the ONLY way a
 * git-tracked path may skip domain classification; everything else must resolve via
 * `domainForPath`, so an over-broad addition here is a visible diff and a review line-item (the
 * same posture as `domains.ts`'s `IGNORE_UNIT`).
 */
const IGNORE_GLOBS: readonly string[] = [
  // session process-exhaust (kickoffs/plans/audit reports) — never shipped or reviewed as product
  "outputs/**",
  // changesets pipeline scratch, consumed + deleted on release — no standing content
  ".changeset/**",
  // root build/lint config + lockfile — no buyer- or audit-relevant content
  "package.json",
  "tsconfig.json",
  "turbo.json",
  // the oxc lint + format configs (ADR-0409) that replaced eslint.config.js / prettier's defaults
  ".oxlintrc.json",
  ".oxfmtrc.json",
  "knip.json",
  "renovate.json",
  "bunfig.toml",
  ".dependency-cruiser.cjs",
  "bun.lock",
  // dotfiles — no audit value
  ".gitignore",
  ".git-blame-ignore-revs",
  ".gitattributes",
  ".dockerignore",
  ".prettierignore",
  // the Node pin file publish-image.yml reads via the NODE_VERSION_FILE repository variable
  // (T28/CAISSON-209) — tool version config, same class as the other root pins
  ".node-version",
  // the serving-revision carrier: a single token that railway-deploy.ts overwrites in the staging
  // tree with the deployed sha, committed holding `unknown` only so every Dockerfile COPY has a
  // source. Deploy-time metadata with no standing content — the committed value is never the
  // interesting one, and the mechanism's own audit lives in packages/kernel + tooling/scripts.
  ".caisson-revision",
  // semgrep scan-scope config (tools/security stack) — a lint-tool ignore list, same class as the
  // other ignore-dotfiles; its own audit lives in the tools/security domain + the security playbook.
  ".semgrepignore",
  // scanner accept/config files (security-scan triage, ADR-0315): trivy's config + reasoned
  // CVE-accept ledger and the osv-scanner root config — same class as .semgrepignore; every accept
  // entry carries its justification inline and the stack's audit is the deterministic CI job.
  "trivy.yaml",
  ".trivyignore.yaml",
  "osv-scanner.toml",
  // repo/CI meta-config — mechanical, no secrets, not a product surface
  ".githooks/**",
  ".github/CODEOWNERS",
  // open-source community files (ADR-0428): license text, contribution/conduct/security policy,
  // issue forms and the PR template — project governance prose, no product or audit surface
  "LICENSE",
  "NOTICE",
  ".mailmap",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/ISSUE_TEMPLATE/**",
  ".github/pull_request_template.md",
];

function isIgnored(path: string): boolean {
  return IGNORE_GLOBS.some((g) => new Bun.Glob(g).match(path));
}

/** Every git-tracked file, repo-relative — the deny-list scan's universe (security floor:
 * `execFileSync` with an arg array, never a shell string). */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !BUILD_OUTPUT.test(p));
}

describe("coverage gate — complete, non-overlapping tree partition (ADR-0233)", () => {
  test("deriveDomains succeeds — every tree unit is classifiable (fails on an unclaimed dir)", () => {
    // Throws if any packages/* dir has no readable package.json — the zzz-probe fail path.
    expect(() => deriveDomains(REPO_ROOT)).not.toThrow();
  });

  const domains = deriveDomains(REPO_ROOT);

  test("every git-tracked file resolves to a domain or a reviewed IGNORE entry — none unclaimed", () => {
    const offenders = trackedFiles().filter(
      (f) => !isIgnored(f) && domainForPath(f, domains) === null,
    );
    // A non-empty list IS the under-scan: name the escaped files loudly.
    expect(offenders).toEqual([]);
  });

  test("no two domains share a root — no double-claim", () => {
    const roots = domains.flatMap((d) => d.roots);
    expect(new Set(roots).size).toBe(roots.length);
  });

  test("the generator carve-out does not double-claim cli source", () => {
    // Every emitted-template file is owned by generator-templates, never also by packages/cli.
    const templateFiles = new Bun.Glob("packages/cli/templates/**").scanSync({
      cwd: REPO_ROOT,
      onlyFiles: true,
      dot: true,
    });
    for (const f of templateFiles) {
      if (BUILD_OUTPUT.test(f)) continue;
      expect(domainForPath(f, domains)?.id).toBe("generator-templates");
    }
  });

  test("classifier spot-checks: the escaped tools/ + root-docs paths are now claimed; a genuinely new, un-ignored path stays unclaimed", () => {
    // (a) tools/security — a tools/ subdir domain (shell scripts).
    expect(domainForPath("tools/security/_common.sh", domains)?.id).toBe(
      "tools/security",
    );
    // (b) a root doc.
    expect(domainForPath("README.md", domains)?.id).toBe("root-docs");
    // (c) Bun's committed dependency patches are audited as internal package-manager tooling.
    expect(
      domainForPath("patches/dependency-cruiser@18.1.0.patch", domains)?.id,
    ).toBe("patches");
    // (d) the Cloud Run deployment surface is executable release infrastructure.
    expect(domainForPath("deploy/plan.ts", domains)?.id).toBe(
      "deploy-pipeline",
    );
    // (e) a hypothetical new top-level dir with no IGNORE entry and no domain: this is exactly the
    // shape the whole-repo scan test above fails loud on — unclaimed AND not ignored.
    expect(domainForPath("newdir/x.ts", domains)).toBeNull();
    expect(isIgnored("newdir/x.ts")).toBe(false);
  });
});
