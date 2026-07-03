import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { deriveDomains, domainForPath } from "./domains.ts";

// The mechanical coverage GATE (ADR-0233 / SPEC audit-harness-v2, task 1). Replaces the v1 hard-coded
// 24-id `toEqual` in domains.test.ts. It proves two things the v1 "run again until a critic goes
// quiet" loop could not: (1) `deriveDomains` succeeds — every tree unit is CLASSIFIABLE (a stray
// packages/* dir with no package.json throws here, so you cannot start a run with an unclaimed dir),
// and (2) every real file under the audited containers resolves to EXACTLY ONE domain (no unclaimed
// = under-scan; no double-claim = the v1 overlap bug). Add a throwaway `packages/zzz-probe/` (no
// package.json) → this test FAILS at `deriveDomains(REPO_ROOT)`; remove it → it passes.

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

// The dirs whose whole subtree the derived domains must tile. Registry is enumerated at its three
// service units (its loose index/ledger files are data, not an audit unit).
const AUDITED_ROOTS = [
  "packages/**",
  "apps/**",
  "services/**",
  "tooling/**",
  "infra/**",
  "registry/worker/**",
  "registry/scripts/**",
  "registry/schema/**",
  ".github/workflows/**",
];

const IGNORED = /(^|\/)(node_modules|dist|\.next|\.turbo|coverage)(\/|$)/;

function auditedFiles(): string[] {
  const out = new Set<string>();
  for (const glob of AUDITED_ROOTS) {
    for (const p of new Bun.Glob(glob).scanSync({
      cwd: REPO_ROOT,
      onlyFiles: true,
      dot: true,
    })) {
      if (!IGNORED.test(p)) out.add(p);
    }
  }
  return [...out];
}

describe("coverage gate — complete, non-overlapping tree partition (ADR-0233)", () => {
  test("deriveDomains succeeds — every tree unit is classifiable (fails on an unclaimed dir)", () => {
    // Throws if any packages/* dir has no readable package.json — the zzz-probe fail path.
    expect(() => deriveDomains(REPO_ROOT)).not.toThrow();
  });

  const domains = deriveDomains(REPO_ROOT);

  test("every real file under the audited roots resolves to exactly one domain — none unclaimed", () => {
    const unclaimed = auditedFiles().filter(
      (f) => domainForPath(f, domains) === null,
    );
    // A non-empty list IS the under-scan: name the escaped files loudly.
    expect(unclaimed).toEqual([]);
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
      if (IGNORED.test(f)) continue;
      expect(domainForPath(f, domains)?.id).toBe("generator-templates");
    }
  });
});
