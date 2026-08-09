import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { deriveDomains } from "./domains.ts";
import { checkScope } from "./scope-guard.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

const DOMAIN_GLOBS = {
  "packages/ui": ["packages/ui/**", "apps/site/**"],
  "packages/tenancy-rls": ["packages/tenancy-rls/**"],
};

describe("checkScope — workflow-scope guard (ADR-0134 §3)", () => {
  test("flags a touched path outside the declared domain(s)", () => {
    const findings = checkScope(
      ["packages/ui"],
      ["packages/tenancy-rls/src/rls.sql"],
      DOMAIN_GLOBS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.domain).toBe("packages/tenancy-rls");
    expect(findings[0]?.subject).toBe("packages/tenancy-rls/src/rls.sql");
    expect(findings[0]?.severity).toBe("high");
    // ADR-0233: scope-creep findings carry the reserved "scope" dimension, keeping their id distinct
    // from a real audit-lens finding on the same path.
    expect(findings[0]?.dimension).toBe("scope");
  });

  test("passes a touched path inside a declared domain", () => {
    const findings = checkScope(
      ["packages/ui"],
      ["packages/ui/src/button.tsx"],
      DOMAIN_GLOBS,
    );
    expect(findings).toHaveLength(0);
  });

  test("passes a path matching no domain at all", () => {
    const findings = checkScope(["packages/ui"], ["README.md"], DOMAIN_GLOBS);
    expect(findings).toHaveLength(0);
  });

  test("multiple out-of-scope paths each produce their own finding, all declared domains stay silent", () => {
    const findings = checkScope(
      ["packages/ui", "packages/tenancy-rls"],
      [
        "packages/ui/src/x.tsx",
        "packages/tenancy-rls/src/y.ts",
        "docs/README.md",
      ],
      DOMAIN_GLOBS,
    );
    expect(findings).toHaveLength(0);
  });

  // Against the REAL derived domain globs: a per-dir touch outside the declared set is flagged to its
  // owning domain (the derived globs use interior stars, which a trailing-only matcher would miss).
  test("flags out-of-scope touches against the real derived domain globs", () => {
    const globs = Object.fromEntries(
      deriveDomains(REPO_ROOT).map((d) => [d.id, d.globs]),
    );
    const findings = checkScope(
      ["packages/ui"],
      ["packages/auth/package.json", "packages/billing/src/index.ts"],
      globs,
    );
    const flagged = findings.map((f) => f.domain);
    expect(flagged).toContain("packages/auth");
    expect(flagged).toContain("packages/billing");
    for (const f of findings) expect(f.severity).toBe("high");
  });
});
