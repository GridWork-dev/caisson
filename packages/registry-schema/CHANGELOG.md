# @caisson/registry-schema

## 0.3.0

### Minor Changes

- d6cc28e: Adds the bundle vocabulary spine: a new additive "bundle" module kind (historical edition entries stay valid), the shared BUNDLE_IDS constant plus the legacy-purchased-id alias map with normalizeEntitlementId, and resolve-time alias normalization at the single entry point inside expandEntitlements — legacy edition and bundle-sentinel purchase ids keep resolving to the identical leaf sets forever, and a kind:"bundle" index entry expands via its members map exactly like an edition. The mcp-server change is test-only coverage of the alias and bundle paths through the generate gate.
- 2834c3f: Bundle upgrade crediting and snapshot-at-sale entitlements. The price book gains a pre-declared item-to-bundle credit map: upgrading from modules you already own to a bundle now credits each owned member's retail against the bundle price, floored at zero, from one source the checkout reads rather than any ad-hoc arithmetic. A companion bundle-membership timeline records when each member joined each bundle. Licenses gain a per-purchase snapshot record so a bundle purchase delivers exactly the member set as of the sale date, filtered fail-soft at the resolver; missing data always favors full access, and older licenses keep unrestricted access unchanged.
- 41e07b6: Module manifests can now declare `sellable: false` to mark a package that ships only as bundle
  substrate and is never sold on its own. The field is optional and defaults to sellable, so every
  existing manifest stays valid and unchanged. The shared cross-service read layer and the commerce
  price-book are both marked bundle-only.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 850b844: Add a README to each of these four packages, documenting the functions and types they
  actually export with a runnable usage example for each. No behavior changes.
- 31d6a41: The alerting and retention-runner modules are now published in the module registry, so buying
  either one on its own grants that module directly instead of resolving to nothing. Buyers who
  purchased either module as a standalone add-on now receive exactly what they paid for.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.

## 0.2.1

### Patch Changes

- b5915e0: Register the `admin_adjust` feature tag (ADR-0220). An operator credit-adjust action rides
  the existing ADR-0074 `feature_grant` / `feature_debit` envelope under this tag rather than adding a
  new base `credit_event` type — so the money core needs no schema change to gain an operator
  correction path. Additive to `REGISTERED_FEATURE_TAGS`; `@caisson/credits` validates it at the
  boundary like any other registered tag.

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected (ADR-0136).
