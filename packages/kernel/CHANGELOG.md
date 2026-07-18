# @caisson/kernel

## 0.5.2

### Patch Changes

- fc0bb99: Rebuilt against this release's refreshed dependency resolution so the published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.5.1

### Patch Changes

- 7de6fa4: Rebuilt against this release's pinned dependencies so the published artifact matches its
  recorded checksum exactly. No functional changes.

## 0.5.0

### Minor Changes

- e5e4311: Per-row audit verification kernel surface. The pure,
  node-free canonical serialization and the JSON value/entry/anchor/verification types move to a new
  `canonical.ts`, so a browser bundle can reach them without the node-tainted `.` barrel. A new
  `@caisson/kernel/audit-verify` subpath adds the WebCrypto `hashChainLinkAsync`,
  `verifyEntryAgainstAnchor`, the six-state `classifyRowState`, and the versioned `buildRowReceipt` (raw
  proof material, no WORM key). A new `@caisson/kernel/redact` subpath holds the redaction predicate
  moved out of ui-pro so the proof-bundle endpoint can mask secret fields server-side. `AuditChainAnchor`
  gains additive optional `sig` and `keyId` fields (signed anchors) that are excluded from the
  canonical core, so unsigned anchors stay byte-identical. The `.` barrel API stays byte-identical and
  the canonical-bytes goldens are unchanged.

  A new `@caisson/kernel/evidence` subpath (T-E1/T-K4) adds `buildEvidencePack(receipts, meta)`: a
  deterministic, self-describing export bundle — the caller's `RowReceipt`s (seq-sorted), a
  self-contained zero-dependency `standalone-verifier.mjs` (no `@caisson/*` import — a third party runs
  `node verify.mjs receipts.json` with no monorepo install), and a README whose trust claim matches
  what the verifier actually checks. `RowReceipt.anchor` gains additive, OPT-IN `genesisHash`/`sig`/
  `keyId` fields (`buildRowReceipt`'s new `includeAnchorProvenance` flag, default off — every existing
  receipt shape, including the live admin proof endpoint's, is byte-identical to before) so a pack can
  carry enough material for its bundled verifier to independently check an anchor's Ed25519 signature
  against a pinned public key — the offline way to verify without trusting caisson.
  When no signing key is embedded, the pack's README states the weaker, honest self-consistency claim
  instead of overclaiming (SPEC copy law).

### Patch Changes

- e183860: Unify the workspace on zod 4 (catalog flip; the zod4 sub-catalog is retired). Explicit key schemas on every z.record call, and the ZodObject generic signatures drop the v3 "strict" type parameter. Runtime validation behavior is unchanged apart from zod 4's tightened RFC-4122 uuid and email format checks, verified against the money and license seams.

## 0.4.3

### Patch Changes

- 2b65cf3: The read-only mutation gate's documentation now reflects its live wiring: the admin
  service's operator maintenance lever is the mode source that feeds `assertNotReadOnly`.
  The gate's behavior is unchanged; the mode is never derived from billing or dunning
  state — a past-due subscription keeps full access.
- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.

## 0.4.2

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.

## 0.4.1

### Patch Changes

- cf66d65: Added a regression test for the operator-allowlist check that pins the constant-time
  comparison contract: every entry is compared, and the number of comparisons performed
  stays the same whether the match is the first entry, the last entry, or no match at all.
  No behavior change — the allowlist check already worked this way.

## 0.4.0

### Minor Changes

- fb8d966: Kernel compliance/auth/fail-closed primitives. New exports:
  `scrubDeep`/`PHI_KEY` (recursive PHI/secret object scrubber composing `scrubForEgress` — deep
  key-name PHI + secret-name subtree drop, leaf credential-span redaction, cycle-guarded, pure,
  idempotent, golden-pinned); `contentHash` (lowercase-hex SHA-256 over `canonicalize(value)` — the
  single-frozen-claim integrity tag, distinct from the `hashChainLink` 2-tuple); `verifyAllowlisted`
  (constant-time allowlist membership over `safeEqualVariable`, no early return, normalized,
  fail-closed on an empty allowlist); `assertNotReadOnly`/`SystemMode` (fail-closed read-only-mode
  mutation gate reusing `ConflictError`); `verifyBearer` (fail-closed constant-time `Authorization:
Bearer` check via `safeEqualFixed`, refusing a blank secret/header/scheme/token — never echoes the
  token).

## 0.3.0

### Minor Changes

- e62c88d: Egress secret-scan hardening (ADR-0215): guardrails' `guard.ts` gains an unconditional `"secret"`
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
- ccf8b10: Branded money types + rounding provenance (ADR-0212).
  Kernel gains `src/money.ts`: TS-native nominal `Cents`/`Credits`/`MicroUsd`/`MicroUsdPerCredit`
  brands (compile-time only, zero runtime cost), `asCents`/`asCredits`/`asMicroUsd`/
  `asMicroUsdPerCredit` constructors (throw `ValidationError` on a non-integer/negative input),
  the identity `unwrapMoney` DB-boundary marker, and the `RoundedMoney<TRaw,TResult>`
  `{raw, mode, result}` record; `centsToCredits` now returns `Credits` and
  `centsToCreditsProvenance` returns the round-DOWN provenance record. Credits: `GrantInput`/
  `DebitInput.amount` are `Credits`, both accept optional `rounding`, and the new
  `CREDIT_ROUNDING_MIGRATION_SQL` (appended as platform migration `0007_credit_rounding.sql` —
  never an edit to the checksum-pinned `CREDIT_SCHEMA_SQL`) adds nullable
  `rounding_raw`/`rounding_mode` to `credit_event` with a biconditional + mode-enum CHECK.
  Pricebook: `creditsPerCycle`/`credits`/`codegenRunCredits` are branded; re-exports
  `centsToCreditsProvenance`. ai-meter: `CostBreakdown` is branded and gains `roundingCredits`
  (`mode: "up"`, ADR-0060) which `reserve()`/`reconcile()` persist onto their ledger rows;
  `BUNDLED_PRICE_BOOK` gains the `openai/text-embedding-3-small` row (ADR-0213 —
  embedding pricing is config, not code; `PRICE_BOOK_VERSION` bumped to 2026-07-02).
  `apply-billing-event` grants stay exact table integers with NULL/NULL provenance
  (ADR-0089 §5); ADR-0007 integer-at-rest is untouched. ai-kit/cli: boundary mints +
  test fixture updates only.

### Patch Changes

- 549dd4e: Security hardening pass. kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, defending against DNS-rebinding. alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first, plus a `subscription_update` regression test.

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 69817a1: Expose `fetchWithTimeout` via a client-safe `@caisson/kernel/fetch` subpath export so browser bundles can honor the fetchWithTimeout rule without pulling the server-only barrel.
