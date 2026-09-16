# @caisson/registry-schema

## 0.5.12

### Patch Changes

- cd694f1: Patch-bump registry-schema because workspace dependency resolution moved under the bun.lock change. The packed bytes differ from the recorded 0.5.11 tarball despite no package source change, so the release needs a new version and an append-only tarball row.

## 0.5.11

### Patch Changes

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

- 886e1e7: Strip internal decision-log citations from the public mirror export, and gate the sync on the exported artifact building, testing, linting and formatting clean before a byte reaches the public repo.

  The ThemeToggle summary no longer repeats its own component name: every other component's manifest summary has that prefix removed by the generator, and this one kept it only because a parenthetical sat between the name and the em dash the generator matches on. Two comments where a decision id was the grammatical subject of a sentence are reworded so the sentence still stands once the id is gone.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- c10e3b6: Update the entitlement graduation notes for the delisted agent-usage id; no runtime behavior changes.

## 0.5.10

### Patch Changes

- Repack against this release's refreshed dependency resolutions so the recorded tarball bytes
  match a fresh pack from the tree. No API or behavior change.

## 0.5.9

### Patch Changes

- e917c52: An entitlement compatibility edge that cannot be resolved no longer discards the buyer's whole entitlement set. Previously one unresolvable edge threw, which dropped a paying customer to the free base floor; now only that edge is skipped and everything else the purchase grants is kept. Skipping cannot over-grant, because an unresolvable target is not a servable module for anyone.

## 0.5.8

### Patch Changes

- 25fd03c: Remove the deprecated full-catalog fallback so a missing Everything bundle entry fails closed.
- a21c478: Adds the standalone $249 OSCAL spine with assessment, results, POA&M, catalog, XML, ISO 27001,
  NIST 800-53, and OLIR support while preserving both parent packages' public exports. The module
  joins Compliance, moving Compliance to $1,649 with a $659 renewal and Everything to $2,259 with
  an $899 renewal.
- 108a358: Test fixtures refreshed for the expanded Compliance and Everything bundle compositions; no runtime changes.

## 0.5.7

### Patch Changes

- 31d59fd: The reserved-entitlement window opens for the four packages entering their first publish
  (access-review, risk-register, trust-page, and the shared artifact-render substrate): their
  bare slugs resolve during the publishing gap and graduate to ordinary indexed resolution at
  their first index entry. Also rebuilt against current dependency resolutions.

## 0.5.6

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.

## 0.5.5

### Patch Changes

- 2229209: Release integrity hardening: every recorded package artifact now carries the dependency
  resolution it was built under, so a resolution change between releases is reported as a
  precise "republish this package" notice instead of a checksum mismatch. The agent loop's
  credit-budget guard is restated in fail-closed form, and stale documentation comments in
  the registry schema and the agent-trajectory manifest are corrected. No behavioral
  changes to published APIs.

## 0.5.4

### Patch Changes

- 5d03808: The Agentic-Dev and Everything bundles now include the agent-trajectory module — the
  governed run record behind agent runs: an append-only, replayable event log with approval
  gating, encrypted-at-rest paused runs, and deterministic replay. Purchases from 18 July
  2026 include it; earlier purchases keep their existing bundle snapshot.

## 0.5.3

### Patch Changes

- f40653b: The entitlement vocabulary reserves the new usage-adapter module's identifier until its
  first published release, so license checks resolve it consistently during the gap between
  the package existing and its catalog entry appearing.

## 0.5.2

### Patch Changes

- 5a09b01: Graduate the agent-trajectory slug out of the reserved entitlement set now that its package carries
  a real registry index entry. Index presence is not sellability — the module stays unsellable,
  unpriced, and outside every bundle members map until its publish gate — but a reservation for an
  indexed package is stale by definition, and its bare slug now resolves through the ordinary
  indexed-module branch.

## 0.5.1

### Patch Changes

- 3f05e1e: Reserve the `agent-trajectory` module slug in the built-but-unpublished entitlement carve-out. The
  trajectory-observation primitive ships before it is offered for sale, so a purchased id matching its
  bare slug now expands to an empty grant rather than failing closed — the same fail-soft handling every
  sold-before-published module already gets, self-expiring the first time the package is indexed.

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
