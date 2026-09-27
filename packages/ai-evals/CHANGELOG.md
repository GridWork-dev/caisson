# @caisson/ai-evals

## 0.5.3

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/agent-trajectory@0.6.2

## 0.5.2

### Patch Changes

- @caisson/agent-trajectory@0.6.1

## 0.5.1

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/agent-trajectory@0.6.0

## 0.5.0

### Minor Changes

- 42d9710: The eval package gains a browser-safe `./browser` entry point: the regression gate's rules with no
  file access at all — the baseline boundary schema, `compareToBaseline`, the pre-bless eligibility
  check, the new `mergeIntoBaseline`, and `wilsonLowerBound` — can now be imported inside a client
  bundle to show or check a comparison. `gateAgainstBaseline` and `loadBaseline` stay on the main
  entry, because they read and write the committed baseline file. The main entry is unchanged and
  keeps the full surface; every browser-entry export is also available there. Internally the rules
  moved into their own module and the file transport now delegates to them, so the bless merge has
  exactly one implementation instead of two. The site's eval interactive demo now runs that real
  code end to end instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [e1226f6]
  - @caisson/agent-trajectory@0.5.0

## 0.4.6

### Patch Changes

- @caisson/agent-trajectory@0.4.1

## 0.4.5

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [13e814d]
- Updated dependencies [96aa01d]
  - @caisson/agent-trajectory@0.4.0

## 0.4.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/agent-trajectory@0.3.4

## 0.4.3

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/agent-trajectory@0.3.3

## 0.4.2

### Patch Changes

- @caisson/agent-trajectory@0.3.2

## 0.4.1

### Patch Changes

- @caisson/agent-trajectory@0.3.1

## 0.4.0

### Minor Changes

- 696b2c5: New graders score an agent run's tool-call trajectory: whether every tool call stayed on
  its declared allowlist, whether the run repeated an already-successful call unnecessarily,
  whether every gated tool executed only under an authorized approval, and whether the run
  stayed inside its credit budget. All four are fully deterministic — no model call, no
  recorded cassette required. A companion dataset, built from real governed-loop runs,
  ships with the package and demonstrates each grader catching a genuine violation without
  tripping any of the others on the same case.

  The approval-compliance grader now also catches a tool that skipped approval entirely: when
  a policy declares a tool name as requiring approval, a call to it that executed with no
  approval decision on record is flagged, not just a call that was approved by the wrong
  person or executed after being denied.

  The regression-baseline gate also gained a safety check: re-baselining (`BLESS=1`) a run
  that does not clear its own quality threshold now fails loudly instead of silently
  overwriting the committed baseline with a worse score.

### Patch Changes

- Updated dependencies [c7476b9]
- Updated dependencies [c3b0e41]
- Updated dependencies [dffd0c1]
- Updated dependencies [696b2c5]
  - @caisson/agent-trajectory@0.3.0

## 0.3.3

### Patch Changes

- e183860: Unify the workspace on zod 4 (catalog flip; the zod4 sub-catalog is retired). Explicit key schemas on every z.record call, and the ZodObject generic signatures drop the v3 "strict" type parameter. Runtime validation behavior is unchanged apart from zod 4's tightened RFC-4122 uuid and email format checks, verified against the money and license seams.

## 0.3.2

### Patch Changes

- 7df836a: The committed injection-defense eval dataset grows from 2 to 20 attack patterns — covering
  encoded and obfuscated overrides, delimiter escapes, tool-invocation coercion, data
  exfiltration via rendered links, indirect injection through retrieved documents,
  role-reversal, false authority, few-shot poisoning, payload splitting, refusal suppression,
  and prompt-extraction attempts. The eval gate additionally enforces a statistical confidence
  floor on the injection scorer, so a shrunk dataset can no longer pass on a flattering mean.

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
