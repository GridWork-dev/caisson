# @caisson/guardrails

## 0.4.3

### Patch Changes

- 2b65cf3: Adds a small offline eval baseline for the PII detection/redaction path, built on the
  existing eval harness package: one dataset pinning that obvious PII (including PII
  pasted inside a fenced code block) gets redacted, and a second dataset pinning that
  clean text and known near-miss shapes (a Luhn-invalid card-shaped number, a
  Unicode-homoglyph-obfuscated email) are correctly left alone. Fully offline and
  deterministic — no model call, no network — so it runs the real detector directly on
  every test run and fails if that logic regresses. Adds the eval harness package as a
  test-only dependency; no runtime behavior changes.
- 7df836a: The PII eval baselines cover more real-world shapes: per-class detector variants
  (parenthesized and country-code phone formats, dash-separated and 15-digit Luhn-valid
  cards, plus-tagged subdomain emails) on the must-redact side, and more must-not-redact
  negatives (Luhn-invalid card-shaped numbers, TLD-less email shapes, separator-less digit
  runs) pinning the detector's false-positive behavior. The PII evals also join the dedicated
  `eval` task, so the AI-regression lane exercises them directly.
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/field-crypto@0.3.1

## 0.4.2

### Patch Changes

- Updated dependencies [8c53ca3]
  - @caisson/field-crypto@0.3.0

## 0.4.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 850b844: Add a README to each of these four packages, documenting the functions and types they
  actually export with a runnable usage example for each. No behavior changes.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2

## 0.4.0

### Minor Changes

- cf66d65: Add an evidence-gated claims evaluator for copy review: given a metric, its
  baseline, and the improvement threshold/margin a claim requires, `claimTier`
  scores the evidence onto a three-rung ladder (unproven / measured /
  validated), and `assertClaimAllowed` throws before a marketing or AI-feature
  claim ships without evidence strong enough to back it. Works with either
  plain ratios or integer money-style values, so a "measurably faster" or
  "industry-leading" claim can be checked against real numbers instead of
  verified by eyeball.

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/field-crypto@0.2.2

## 0.3.0

### Minor Changes

- e62c88d: (ADR-0215): guardrails' `guard.ts` gains an unconditional `"secret"`
  `GuardCategory` — a credential-shaped span (AWS/GitHub/OpenAI keys, JWTs, PEM blocks, secret-named
  assignments, URL userinfo passwords) now blocks at the cheap pre-screen tier, before the (possibly
  outaged) `Moderator` ever runs, closing the named egress-secret asymmetry. The `scrubForEgress`/
  `looksLikeSecret` predicate moves to `@caisson/kernel` (`secret-scrub.ts`) — the shared zero-dep base
  both `guardrails` and `local-store` already depend on — so the predicate has exactly one
  implementation; `@caisson/local-store`'s `egress-guard.ts` re-exports it, keeping its public surface
  and golden-pinned scrub contract unchanged (internal-only move, patch). `@caisson/guardrails` also
  ships a new standalone FTC "4 Ps" dark-pattern presentation guardrail (`ftc4p.ts`): a pure heuristic
  evaluator scoring marketing/UI copy against prominence/presentation/placement/proximity for false
  urgency, forced continuity, confirmshaming, opt-out-framed enrollment, and drip pricing, optionally
  wrappable as a `Moderator` via `ftc4pModerator`.

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [081a1d8]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/field-crypto@0.2.1

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Security hardening pass: emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition; guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Coverage was also extended to the admin-plane,
  metering/BYOK, destructive-jobs, composition-root, and WORM-integrity surfaces.
- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/field-crypto@0.2.0
  - @caisson/kernel@0.2.0
