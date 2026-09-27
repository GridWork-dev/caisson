# @caisson/kernel

## 0.10.1

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.

## 0.10.0

### Minor Changes

- 7d39669: Report the serving revision on every deployed service.

  Each service now answers with an `x-caisson-revision` response header naming the commit its
  running image was built from, so "which code is actually live" is one request instead of an
  inference from how a route behaves.

  The kernel gains `servingRevision()` and the constants behind it on the `@caisson/kernel/node`
  entry. It reads a `.caisson-revision` carrier written into the uploaded tree at deploy time; a
  build that did not come through that path reports `unknown` rather than guessing.

  The header is deliberately not gated behind origin verification: it has to stay readable exactly
  when that gate is the thing misbehaving, which is the case it exists to diagnose.

- 498b279: Add fixed-length origin request verification with two-secret rotation support.

### Patch Changes

- 87b07c6: Redact camelCase, snake_case, plural, numbered, fused and fullwidth PII attribute keys. The span
  attribute deny-list's word-boundary terms could not see a boundary inside `userEmail` or
  `user_email`, so PII-named span attributes reached the OTLP sink unredacted. `isSensitiveAttributeKey`
  is the new predicate: it NFKC-normalizes the key and tests the deny-list against both the raw key and
  a camelCase/snake_case word split; the raw `SENSITIVE_ATTRIBUTE_KEY` export is deprecated for direct
  use. The kernel deep scrubber gains the same camelCase split for its anchored `dob`/`mrn` tokens.
  Both splitters are linear in the key length.

## 0.9.0

### Minor Changes

- f669d4a: Add narrow browser decision entries that exclude configuration, event delivery, and fetch-capable
  code. Browser field encryption now imports the restricted kernel surface, while local-privacy offers
  policy admission checks without exposing its network wrapper.

  Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
  taken from a base that predated the merge, so this changeset records the bump only.

- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

### Patch Changes

- b0e66b6: Clarify the internal module boundaries for local embed scrubbing and AI token-rate normalization. Public exports and runtime behavior are unchanged.
- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

## 0.8.0

### Minor Changes

- 7d74f8f: The browser-safe `@caisson/kernel/audit-verify` entry point now covers whole-chain verification,
  not just single rows: `buildChainAsync`, `chainEntryAsync`, and `verifyChainAsync` are WebCrypto
  twins of the Node chain builders, and `anchorChain` is available there as the same function the
  Node side already calls. A client or an offline pack verifier can now check that a chain is the
  complete original one, which is the check a cut tail turns on, without pulling the Node crypto
  module. The main entry and the Node entry are unchanged in name, shape, and behaviour, and the
  twins are pinned byte for byte against the originals. The site's audit chain interactive demo now
  runs those real functions end to end instead of a hand-maintained copy.

## 0.7.0

### Minor Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

### Patch Changes

- e917c52: The auditor README inside an exported evidence pack no longer prints two commands its reader cannot run. One was an install command for a package that is not distributed through a package registry, and the other pointed at a checkout of a private repository. In their place the README states plainly how the sanctioned verifier is obtained, and names the openly licensed kernel entry points that rebuild the signed bytes and re-check every row, which is the route available to a reader with no relationship to the issuer.

## 0.6.0

### Minor Changes

- 31bf5f1: Evidence packs now use a v2 detached seal over a canonical manifest containing every exported file
  name and SHA-256 digest, and no longer embed executable verifier code. The new commercial
  `@caisson/verify-pack` package is the independently obtained verification path and requires an
  issuer-key fingerprint obtained independently from the pack before it can report PASS.

### Patch Changes

- 31bf5f1: Harden deep redaction so compound credential keys and embedded sensitive spans cannot cross display
  surfaces, and make audit proof/evidence-pack exports project payloads through a per-event-type
  allowlist that drops unknown fields and fails closed for unknown event types. Also support
  append-only composed migration prefixes and bind authenticated evidence packs to a signed complete
  snapshot seal.

## 0.5.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.

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
