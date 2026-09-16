# @caisson/pricebook

## 0.8.5

### Patch Changes

- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/registry-schema@0.5.12
  - @caisson/kernel@0.10.0

## 0.8.4

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
- b0e66b6: Clarify the internal module boundaries for local embed scrubbing and AI token-rate normalization. Public exports and runtime behavior are unchanged.
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

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/kernel@0.9.0
  - @caisson/registry-schema@0.5.11

## 0.8.3

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10

## 0.8.2

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/registry-schema@0.5.9

## 0.8.1

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0

## 0.8.0

### Minor Changes

- 108a358: Adds the three new compliance modules — access-review ($199), risk-register ($279), and trust-page ($149) — to the retail, purchase, renewal, and bundle-membership books. Compliance now lists at $1,649 with a $659 updates renewal.
- 96aa01d: Record what a buyer paid for each entitlement, and use it as the floor on an upgrade credit.

  An upgrade credit is the retail of each owned item the buyer is trading in. That understates the
  credit for anyone who bought before a price cut: they paid more than the item now lists for, and the
  old behaviour credited them the lower number. The credit now takes whichever is greater, the item's
  retail or what the buyer actually paid.

  Paying for that needs the buyer's own price, which was never stored. It has always been on the
  provider event, one charge per line, but only the whole transaction's total was persisted, and a
  total cannot be split across a multi-item cart afterwards. A new nullable column on the entitlement
  grant records the line's charge and currency at grant time.

  The amount is recorded only when the line's charge is genuinely one item's price. A line bought at
  quantity two charges twice for a single entitlement, and a provider that reports no per-line figure
  sends zero. Both leave the column empty, which reads as unknown and credits at retail, rather than
  inventing a per-item split.

  The quote function takes the paid amounts as an argument, so the pricebook stays free of database
  access and the tenant-scoped read stays with the caller. Each one is an amount together with its
  currency, never a bare integer: a charge of 29900 is $299 in one currency and roughly twice that in
  another, and the two cannot be told apart from the number alone. A charge in a currency the catalog
  does not price in credits at retail rather than being converted, because converting it would mean
  inventing an exchange rate.

- a21c478: Adds the standalone $249 OSCAL spine with assessment, results, POA&M, catalog, XML, ISO 27001,
  NIST 800-53, and OLIR support while preserving both parent packages' public exports. The module
  joins Compliance, moving Compliance to $1,649 with a $659 renewal and Everything to $2,259 with
  an $899 renewal.

### Patch Changes

- fe2dfac: Persist each renewal's month tenor and reverse the full stored interval on refund, with legacy rows defaulting to twelve months.
- Updated dependencies [25fd03c]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
  - @caisson/registry-schema@0.5.8
  - @caisson/kernel@0.6.0

## 0.7.2

### Patch Changes

- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7

## 0.7.1

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3
  - @caisson/registry-schema@0.5.6

## 0.7.0

### Minor Changes

- 2bda239: The updates-renewal book can now carry a multi-year tenor per SKU: a renewal row may extend
  the updates window by two or three years in one purchase instead of a flat one-year
  extension, with every existing renewal row unchanged and still resolving to its one-year
  default. The site's renewal-pricing helpers gained a matching multi-year display
  calculation, floored to the same whole-dollar-ending-in-9 price points as the existing
  one-year renewal prices. No SKU is sold on a multi-year tenor yet and no new price appears
  anywhere in the product — this lands the machinery only.

## 0.6.1

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5

## 0.6.0

### Minor Changes

- 6f0af8a: The agent-trajectory module is now purchasable: priced at $49 a la carte, creditable
  toward an Agentic-Dev or Everything bundle upgrade, with its bundle membership recorded
  in the pricing timeline as of 18 July 2026. The purchase and renewal books route its
  checkout and updates-renewal to the module's entitlement, and the pricing page lists it
  alongside the other Agentic-Dev modules with its own mechanism diagram.

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.5.6

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1

## 0.5.5

### Patch Changes

- Updated dependencies [f40653b]
  - @caisson/registry-schema@0.5.3

## 0.5.4

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2

## 0.5.3

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1

## 0.5.2

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/registry-schema@0.5.0

## 0.5.1

### Patch Changes

- 9a81dd7: Edition-trace purge: repoint every mint site off the dissolved edition ids. The four
  archived-edition + bundle-sentinel rows in `PURCHASE_BOOK` and `RENEWAL_BOOK` now emit the canonical
  six-bundle ids (`ai-production`/`local-first`/`agentic-dev`/`everything`), so no new purchase or renewal
  can mint a legacy id, and a replay of any historical sandbox event grants the canonical id. `resolveRenewal`
  drops its now-dead bundle-alias normalization (every row stores a canonical id; the read-side alias fold for
  a future module rename stays where a grant id is consumed). Version stamps bumped (append-only versioning).
- 2b65cf3: The Priority Support annual plan now grants 1,000 credits per cycle — matching the
  Developer plan's allotment — replacing the earlier nominal 100-credit placeholder.
- 99d665a: Added a `PLAN_BOOK` row for the priority-support subscription ($999/yr, next-business-day
  first response), carrying the `priority-support` entitlement id and an annual cadence. Kept as a
  PLACEHOLDER price id like every other row in this section until the operator creates the matching
  Paddle product and swaps in the real price id — the same graduation the Developer and
  Compliance-Updates rows already took.
- Updated dependencies [3d23da7]
- Updated dependencies [9a81dd7]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [4d85f28]
  - @caisson/registry-schema@0.5.0
  - @caisson/kernel@0.4.3

## 0.5.0

### Minor Changes

- Plan-book entries gain an optional boolean field marking a subscription plan as covering the
  buyer's already-owned entitlements while the subscription is active. The Developer plan rows
  now carry it: each billing cycle re-grants everything the buyer holds from one-time purchases
  as subscription-sourced access, so updates and newly added bundle members keep flowing while
  the plan is active and stop at cancellation. Plans without the field behave exactly as before;
  the pricebook version stamp bumps accordingly.
- 8170382: Append the W7 sandbox catalog rows: 17 one-time purchase rows (11 carve/new module SKUs plus the six bundles keyed to canonical bundle ids) and 12 renewal rows (the Provenance bundle plus the eleven carve/new SKUs). Both book versions bump; existing rows untouched (append-only).

### Patch Changes

- Updated dependencies [8170382]
  - @caisson/registry-schema@0.4.0

## 0.4.0

### Minor Changes

- 2834c3f: Bundle upgrade crediting and snapshot-at-sale entitlements. The price book gains a pre-declared item-to-bundle credit map: upgrading from modules you already own to a bundle now credits each owned member's retail against the bundle price, floored at zero, from one source the checkout reads rather than any ad-hoc arithmetic. A companion bundle-membership timeline records when each member joined each bundle. Licenses gain a per-purchase snapshot record so a bundle purchase delivers exactly the member set as of the sale date, filtered fail-soft at the resolver; missing data always favors full access, and older licenses keep unrestricted access unchanged.
- 4d7eb71: New RENEWAL_BOOK: one updates-renewal SKU per renewable edition/module mapping a Paddle price id to the entitlement whose 12-month updates window it extends. Fail-closed resolveRenewal plus the isRenewalPrice branch predicate; a price id lives in exactly one of PURCHASE_BOOK / PLAN_BOOK / RENEWAL_BOOK. Live sandbox price ids; cents live in Paddle, never in code.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 41e07b6: Module manifests can now declare `sellable: false` to mark a package that ships only as bundle
  substrate and is never sold on its own. The field is optional and defaults to sellable, so every
  existing manifest stays valid and unchanged. The shared cross-service read layer and the commerce
  price-book are both marked bundle-only.
- e784af1: An updates-renewal now resolves the current bundle name of the edition it renews. A renewal
  written against an edition's earlier name still points at the same entitlement after the catalog
  is reorganized into bundles, so a renewal keeps extending the correct updates window regardless of
  which naming the renewal row was created under.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [850b844]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/registry-schema@0.3.0

## 0.3.2

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.3.1

### Patch Changes

- 3a7a4fd: Drop the four edition-core a-la-carte purchase rows: compliance/ai-kit/local-ai/agent-dev module SKUs named their own edition entitlement id and expanded to the whole parent edition; no separable core artifact exists. Their PLACEHOLDER + REAL sandbox price-id rows are removed and resolvePurchase now fails closed on the retired ids. 11 standalone module rows remain.
- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.3.0

### Minor Changes

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

- 52c6738: Wire the real Paddle sandbox price ids for the 15 a-la-carte module SKUs
  (including the newly locked agent-runner module) plus a direct credit-pack
  row into PURCHASE_BOOK (module-SKU wiring). Every module row is a perpetual
  license-only buy (credits 0, entitlements the bare module slug), mirroring
  the earlier edition/bundle REAL rows; the credit-pack REAL row grants 5000
  credits and no entitlement, mirroring its own PLACEHOLDER row. The existing
  PLACEHOLDER rows stay in place as bound purchases.test.ts fixtures, and
  agent-runner gains a matching PLACEHOLDER row for convention symmetry. The
  alerting/retention-runner rows drop their stale FUTURE/not-yet-built caveat:
  both shipped in Stage-2 (ADR-0150/ADR-0151) and are registry-indexed.
  PURCHASE_BOOK_VERSION bumped to 2026-07-02.1 (ADR-0006 append-only).
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 59d332f: Edition seam-completion (ADR-0179..0185).

  - `@caisson/compliance`: OSCAL export lifted to v1.2.2 with a JSON→XML converter path (`oscal-export-xml`)
    and NIST-conformant SAR + POA&M output across all three frameworks (SOC2/HIPAA/EU-AI-Act) — finding
    status carries a constrained token + `remarks`, POA&M satisfies the `poam-items` min-1 XSD rule with a
    truthful "no open items" entry rather than a fabricated gap, and the root `props` block is dropped. Adds
    the AI-risk-register + field-crypto-policy collectors.
  - `@caisson/ai-kit`: BYOK key resolver (free-tier + edge-safe).
  - `@caisson/observability`: manual Bun-OTel request spans (`request-span`).
  - `@caisson/pricebook`: seam action export.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
