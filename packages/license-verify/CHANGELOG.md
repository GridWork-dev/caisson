# @caisson/license-verify

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
