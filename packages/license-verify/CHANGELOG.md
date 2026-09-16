# @caisson/license-verify

## 0.3.10

### Patch Changes

- 7d39669: Document what a license key stopping actually looks like, and the three things that cause it.

  The README explained the fail-safe-to-community mechanism but never named the symptom a buyer
  searches for. It now covers the common case — a renewal that never reached the process, since
  verification reads the token it is handed — alongside an elapsed expiry and a major-version
  boundary, and says how to tell the three apart. Behaviour is unchanged; this is documentation.

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 0.3.9

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

## 0.3.8

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.3.7

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.3.6

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.3.5

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.3.4

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.3.3

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.3.2

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.3.1

### Patch Changes

- 317bad5: Add an optional `eval` claim to the signed license shape. A verified license now reports whether
  it was issued as a time-boxed evaluation grant rather than a paid purchase, so a consuming
  application can apply different handling (for example, watermarking or excluding evaluation
  installs from redistribution) without guessing from the expiry date alone. Existing tokens and
  integrations are unaffected: the field is absent unless an issuer explicitly sets it, and every
  paid license continues to verify exactly as before.
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
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.3.0

### Minor Changes

- 2834c3f: Bundle upgrade crediting and snapshot-at-sale entitlements. The price book gains a pre-declared item-to-bundle credit map: upgrading from modules you already own to a bundle now credits each owned member's retail against the bundle price, floored at zero, from one source the checkout reads rather than any ad-hoc arithmetic. A companion bundle-membership timeline records when each member joined each bundle. Licenses gain a per-purchase snapshot record so a bundle purchase delivers exactly the member set as of the sale date, filtered fail-soft at the resolver; missing data always favors full access, and older licenses keep unrestricted access unchanged.
- 4d7eb71: License claims now track each purchased module or edition's own 12-month updates window instead of one window for the whole account. Renewing one module extends only that module — your other purchases keep their own dates, and a fresh purchase always gets a full fresh window rather than inheriting an older one. A token without any window info, or missing an entry for a given purchase, is treated as unrestricted, so every license issued before this change keeps working exactly as before. When a module is covered by more than one purchase (say, bought individually and again as part of a bundle), you always get the better of the two windows.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 90b6dc1: Rotate the baked license verification key again and remove every committed license token
  from the test suite; worker tests now mint development-key tokens at runtime.
- f178f9a: Rotate the baked production license verification key. Tokens signed by the retired key no
  longer verify; fresh tokens issued after 2026-07-05 verify against the new key.
- 9efcff2: No production-signed license token ships in the package anymore: the committed golden fixture is
  removed, and the test suite now proves the shipped key bake negatively — a dev-keypair-signed
  token is rejected by the default entrypoint, while all verify logic is exercised through the
  explicit-key seam with the documented deterministic dev keypair.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
