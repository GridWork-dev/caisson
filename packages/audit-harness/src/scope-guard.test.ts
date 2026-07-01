import { describe, expect, test } from "bun:test";

import { AUDIT_DOMAINS } from "./domains.ts";
import { checkScope } from "./scope-guard.ts";

const DOMAIN_GLOBS = {
  "design-ui": ["packages/ui/**", "apps/site/**"],
  "rls-tenancy": ["packages/tenancy-rls/**"],
};

describe("checkScope — workflow-scope guard (ADR-0134 §3)", () => {
  test("flags a touched path outside the declared domain(s)", () => {
    const findings = checkScope(
      ["design-ui"],
      ["packages/tenancy-rls/src/rls.sql"],
      DOMAIN_GLOBS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.domain).toBe("rls-tenancy");
    expect(findings[0]?.subject).toBe("packages/tenancy-rls/src/rls.sql");
    expect(findings[0]?.severity).toBe("high");
  });

  test("passes a touched path inside a declared domain", () => {
    const findings = checkScope(
      ["design-ui"],
      ["packages/ui/src/button.tsx"],
      DOMAIN_GLOBS,
    );
    expect(findings).toHaveLength(0);
  });

  test("passes a path matching no domain at all", () => {
    const findings = checkScope(["design-ui"], ["README.md"], DOMAIN_GLOBS);
    expect(findings).toHaveLength(0);
  });

  test("multiple out-of-scope paths each produce their own finding, all declared domains stay silent", () => {
    const findings = checkScope(
      ["design-ui", "rls-tenancy"],
      [
        "packages/ui/src/x.tsx",
        "packages/tenancy-rls/src/y.ts",
        "docs/README.md",
      ],
      DOMAIN_GLOBS,
    );
    expect(findings).toHaveLength(0);
  });

  // Guards against a trailing-only matcher: the real manifest uses interior stars
  // ("packages/*/package.json", "packages/**/src/**/*rls*") that a naive prefix match silently drops.
  test("flags out-of-scope touches against the real AUDIT_DOMAINS interior-star globs", () => {
    const globs = Object.fromEntries(AUDIT_DOMAINS.map((d) => [d.id, d.globs]));
    const findings = checkScope(
      ["design-ui"],
      ["packages/auth/package.json", "packages/billing/src/rls-policy.ts"],
      globs,
    );
    const flagged = findings.map((f) => f.domain);
    expect(flagged).toContain("licensing-spdx"); // packages/*/package.json
    expect(flagged).toContain("rls-tenancy"); // packages/**/src/**/*rls*
    for (const f of findings) expect(f.severity).toBe("high");
  });
});
