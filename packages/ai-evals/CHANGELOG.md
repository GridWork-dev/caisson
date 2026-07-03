# @caisson/ai-evals

## 0.2.1

### Patch Changes

- 7eb77cb: Eval-science depth (ADR-0214, harvest slice-2): a dependency-free exit-reason classifier
  (`classifyExit`), an opt-in Wilson-CI confidence-floor gate augmentation (`wilsonFloor` on
  `DefineEvalConfig`/`EvalRun`, additive — unset is zero behavior change), a budget-isolated
  eval-spend ledger (`recordEvalSpend`, never touches `@caisson/ai-meter`), a production
  judge/human reflexivity queue (`captureDisagreement`/`consolidateReflexivityQueue`, queued for
  operator review, never auto-merged into a golden dataset), and Fleiss-kappa ensemble agreement +
  counterfactual stability scoring (`fleissKappa`/`ensembleAgreement`/`counterfactualStability`).

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Whole-repo audit round-3 remediation (ledger 2026-07-01): emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Plus the round-4/5 audit domains (admin-plane,
  metering-byok, destructive-jobs, composition-roots, worm-integrity) added to AUDIT_DOMAINS.
