// Audit surface manifest (ADR-0134 §1). A data-only declared inventory of every auditable domain
// in this monorepo — each domain names the checker(s) that own it. Declaration only: no execution,
// no IO. `checkScope` (./scope-guard.ts) reads `globs` at call time; nothing here runs a checker.

export interface AuditDomain {
  id: string;
  description: string;
  globs: string[];
  checkers: string[];
}

export const AUDIT_DOMAINS: readonly AuditDomain[] = [
  {
    id: "security",
    description:
      "The security floor (secrets, shell exec, auth, headers, timing-safe compares) across every package.",
    globs: ["packages/**/src/**", "services/**/src/**", "apps/**/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "rls-tenancy",
    description:
      "Row-level-security + tenant isolation boundary (ADR-0005): the withTenant AsyncLocalStorage seam and every RLS policy.",
    globs: ["packages/tenancy-rls/**", "packages/**/src/**/*rls*"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "licensing-spdx",
    description:
      "The open↔commercial license boundary (ADR-0094/0097/0111/0136): SPDX headers, LICENSE files, no-depend-up.",
    globs: [
      "packages/*/LICENSE",
      "packages/*/package.json",
      "packages/*/manifest.ts",
    ],
    checkers: ["standards-gate"],
  },
  {
    id: "design-ui",
    description:
      "Design-system + marketing/UI surfaces (ADR-0101): tokens, components, the six deterministic gates.",
    globs: ["packages/ui/**", "apps/site/**", "apps/studio/**"],
    checkers: ["tooling/design-critic"],
  },
  {
    id: "standards-gate",
    description:
      "The one standards gate itself (tsconfig/eslint/test/golden-file/manifest wiring) — the gate that gates every other domain.",
    globs: [
      "tooling/standards-gate/**",
      "tooling/eslint-config/**",
      "tooling/tsconfig/**",
    ],
    checkers: ["standards-gate"],
  },
  {
    id: "evidence-compliance",
    description:
      "Evidence-pack + WORM audit-chain controls (ADR-0057) backing the Compliance edition.",
    globs: [
      "packages/compliance/**",
      "packages/audit-worm/**",
      "packages/field-crypto/**",
    ],
    checkers: ["gw-security-auditor", "standards-gate"],
  },
];
