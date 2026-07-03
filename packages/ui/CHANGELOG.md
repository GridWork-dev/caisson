# @caisson/ui

## 0.3.0

### Minor Changes

- bd9a005: 15 new bespoke icon marks: the nine remaining standalone-module glyphs
  (retention-runner, alerting, ai-meter, ai-evals, guardrails, prompt-registry, local-store,
  agent-kernel, agent-runner), the four edition marks on the shared caisson waterline/chamber form
  (edition-compliance, edition-ai-kit, edition-local-ai, edition-agent-dev), the Everything-bundle
  mark, and a plan-tier mark. Same contract as the existing bespoke set: 24-grid, 2px stroke,
  currentColor, no fill — additive to `IconName`, no breaking change.

## 0.2.1

### Patch Changes

- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- 6e08cc6: Declare turbo build outputs (noEmit typecheck, outputs []) — build-tooling metadata only, no runtime change.

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).
