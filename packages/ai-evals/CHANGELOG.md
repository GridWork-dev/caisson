# @caisson/ai-evals

## 0.3.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 850b844: Add a README to each of these four packages, documenting the functions and types they
  actually export with a runnable usage example for each. No behavior changes.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.

## 0.3.0

### Minor Changes

- cf66d65: Eval runs, eval-spend ledger entries, and reflexivity-queue captures now read their timestamp
  from an injected `Clock` (`systemClock` by default) instead of reading the system clock directly.
  New exports: `Clock`, `systemClock`, `fixedClock`, `sequencedClock`. `defineEval`'s result also
  carries a `ranAt` timestamp.

  Practically, this means a historical backtest can replay a past eval run through the exact same
  code that runs live evals today, just by supplying a fixed or sequenced point in time — no
  separate "replay mode" to keep in sync with the real thing, and no risk of a backtest silently
  drifting from live behavior over time.

## 0.2.1

### Patch Changes

- 7eb77cb: Eval-science depth (ADR-0214): a dependency-free exit-reason classifier
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

- 22077d1: Security and reliability hardening: emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason; judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition; guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content.
