# @caisson-sh/guardrails

## 0.5.2

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [8226c84]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/field-crypto@1.1.3
  - @caisson-sh/kernel@0.10.1

## 0.5.1

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0
  - @caisson/field-crypto@1.1.2

## 0.5.0

### Minor Changes

- f669d4a: Add a browser-safe entry with the shared PII detector and mask, WebCrypto-based async hash and field-tokenization twins, and the fail-closed guard. The browser seam requires WebCrypto globals and now declares Node.js 20.12 or newer for supported server runtimes.

  Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
  taken from a base that predated the merge, so this changeset records the bump only.

- e6866e5: Harden the guard against denial-of-service and verdict-swallowing failure modes. Both guard
  entries now reject text over the 100k-code-unit work ceiling and unsafe caller-configured
  cheap-deny patterns (backreferences, lookarounds, nested quantifiers and multiply-repeated
  alternation groups at any nesting depth, more than one unbounded wide-atom quantifier, and
  excessive bounded repetition — while open-ended `{n,}` repetition and once-only `?` groups stay
  allowed) before any regex or moderator work; a malformed moderator verdict is parsed strictly
  and fails closed even under an explicit failOpen policy, which covers outages and timeouts
  only; a PII field-crypto context bound to a different tenant than the guard
  runtime is rejected before moderation or telemetry; and a synchronously throwing event sink can
  no longer replace the block error. PII placeholder restoration is growth-bounded, and guardOutput
  on both entries now accepts the same PII-bearing policy shape as the input leg.

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/field-crypto@1.1.1

## 0.4.12

### Patch Changes

- Updated dependencies [8875592]
- Updated dependencies [7d74f8f]
  - @caisson/field-crypto@1.1.0
  - @caisson/kernel@0.8.0

## 0.4.11

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/field-crypto@1.0.1

## 0.4.10

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
  - @caisson/field-crypto@1.0.0
  - @caisson/kernel@0.6.0

## 0.4.9

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/field-crypto@0.3.5
  - @caisson/kernel@0.5.3

## 0.4.8

### Patch Changes

- 8ff4c62: Rebuilt against this release's refreshed dependency resolution so the published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.4.7

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/field-crypto@0.3.4

## 0.4.6

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/field-crypto@0.3.3

## 0.4.5

### Patch Changes

- 4c6d3f7: Rebuilt against this release's updated platform dependencies so each published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.4.4

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/field-crypto@0.3.2

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
