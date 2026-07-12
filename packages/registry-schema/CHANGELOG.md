# @caisson/registry-schema

## 0.5.0

### Minor Changes

- 99d665a: Added `NON_MODULE_ENTITLEMENT_IDS` (currently `priority-support`): entitlement ids
  that are sold and stored as purchased grants for their own routing purpose but are not a package
  and never will be. `expandEntitlements` now resolves them to no members instead of throwing, so a
  buyer who holds one alongside real software entitlements never has their whole account's
  entitlement expansion fail closed over an id with nothing to expand to.

### Patch Changes

- 3d23da7: Re-capture the real-index expansion pins for the bundle-only registry index: the three dissolved
  edition meta-packages left the served index, so bundle leaf sets no longer contain them and a bare
  edition purchase id now rejects fail-closed (degrading to the free base floor at every consumer)
  instead of resolving to its meta-package.
- 9a81dd7: Edition-trace purge: narrow the purchased-id alias spine to nothing-but-the-mechanism. The
  four dissolved edition ids (`ai-kit`/`local-ai`/`agent-dev`) and the legacy `bundle` "buy-everything"
  sentinel are removed from `LEGACY_ENTITLEMENT_ALIASES` (zero real buyers hold them) and the `BUNDLE_ID`
  export is deleted. The edition→bundle INDEX-resolution relation moves to the decoupled `EDITION_BUNDLE_ID`
  map so `expandEntitlements` still folds the historical `kind:"edition"` meta-packages' members into a
  canonical bundle purchase — every live-index and offline-token member set is byte-identical. The single
  `normalizeEntitlementId` alias point and the read-side `entitlementIdAliasGroup` are kept (now empty) for
  the next module rename. `legacyEditionNamesFor` is newly exported (additive) so the generator's edition-pin
  resolver reads the same decoupled edition→bundle relation. No public value behavior changes for the
  six-bundle vocabulary; a dissolved edition id now resolves only to its still-served meta package (a
  fail-safe under-grant), never over-grants.
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
- ab352ab: Internal test hardening: an explicit everything-bundle leaf-set pin guards the expansion membership.
- 4d85f28: The reserved-id carve-out for ui-pro is removed from entitlement expansion: a ui-pro
  purchase now resolves to the real module grant, and the fail-closed rejection of unknown
  ids applies to it on any index that does not ship it. The standards gate gains the ui-pro
  price-authority row.

## 0.4.0

### Minor Changes

- 8170382: Add `entitlementIdAliasGroup` — the read-side reverse of `normalizeEntitlementId`, returning every stored spelling (canonical id plus legacy aliases) of one entitlement so renewal fulfillment can match grants written under the pre-fold vocabulary.

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
