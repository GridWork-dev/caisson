import { describe, expect, test } from "bun:test";

import { AUDIT_DOMAINS } from "./domains.ts";

describe("AUDIT_DOMAINS — the declared inventory (ADR-0134 §1)", () => {
  test("covers the ADR-0134 domains plus the round-2/3/4/5 extensions, each with globs + checkers", () => {
    const ids = AUDIT_DOMAINS.map((d) => d.id).sort();
    expect(ids).toEqual(
      [
        // ADR-0134 founding six
        "design-ui",
        "evidence-compliance",
        "licensing-spdx",
        "rls-tenancy",
        "security",
        "standards-gate",
        // round-2 (2026-07-01): surfaces the founding globs never reached
        "ci-supply-chain",
        "financial-integrity",
        "iac-authz",
        "python-services",
        "registry-edge",
        "telemetry-egress",
        // round-3 (2026-07-01): completeness-critic gaps
        "agent-governance",
        "ai-evals-integrity",
        "auth-boundary",
        "email-egress",
        "generator-templates",
        "guardrails-prompts",
        "mcp-transport",
        // round-4/5 (2026-07-01): never-audited risk-bearing surfaces + the
        // audit-worm name-collision correction (round-3 critic said audit-harness)
        "admin-plane",
        "composition-roots",
        "destructive-jobs",
        "metering-byok",
        "worm-integrity",
      ].sort(),
    );
    for (const d of AUDIT_DOMAINS) {
      expect(d.globs.length).toBeGreaterThan(0);
      expect(d.checkers.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  test("ids are unique", () => {
    const ids = AUDIT_DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
