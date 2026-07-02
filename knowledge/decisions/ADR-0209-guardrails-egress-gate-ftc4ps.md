# ADR-0209 — guardrails: egress secret-gate wiring + FTC-4Ps dark-pattern presentation guardrail

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope + harden-in-place locks).
**Relates:** ADR-0063 (guardrails module), ADR-0133 (clean-lift: secret-detect et al.), lift-sweep #13
(tm-watch FTC-4Ps pattern, rebuild-clean), ADR-0067 (local-store, current home of `looksLikeSecret`).

## Context

The reconcile found guardrails' four clean-lift capabilities (secret-detect, timing-safe compare, security
headers, sandbox exec) covered — but scattered across kernel/local-store/agent-dev/tool-exec rather than
surfaced through the guardrails package. Two genuine gaps: guard.ts has no secret/credential GuardCategory
(the `looksLikeSecret` predicate exists in local-store's egress guard, already duplicated once in
agent-dev's emitter — a third re-derivation is the anti-pattern), and no dark-pattern presentation
guardrail exists anywhere (the only FTC-4Ps artifact is a hand comment in the site's pricing copy).

## Decision

1. **Egress secret-gate:** a secret/credential GuardCategory wired into guard.ts reusing the ONE existing
   predicate. The sharing seam (import down vs lift the pure predicate to the lowest legal license home)
   is resolved at SPEC time against both packages' tiers — the binding rule is: one predicate, one home,
   consumers import it; no third copy.
2. **FTC-4Ps presentation guardrail:** a heuristic rule-set evaluating marketing/UI copy against
   prominence, presentation, placement, proximity — Zod-typed findings with per-P scores, no LLM
   dependency (judge-port-compatible optional), scareware-style test fixtures.

## Rejected

- **Re-derive the secret regex set inside guardrails** — the repo already carries two copies; a third is
  exactly the drift the harvest exists to close.
- **LLM-backed 4Ps classifier as the primary path** — a heuristic rule-set is deterministic, testable, and
  dependency-free; a judge can layer on top via the existing port.
