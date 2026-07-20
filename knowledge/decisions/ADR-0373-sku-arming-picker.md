# ADR-0373 — SKU arming picker: first prices, Compliance reprice, two-consume arming sequence

- **Status:** locked
- **Date:** 2026-07-20
- **Fork:** the pricing + triage picker at the post-close-out sitting (two rounds, seven locks)

## Decisions (operator picker)

1. **First prices for the three reserved compliance SKUs:** access-review **$199** (bottom of
   the memo range — v1 has no live IdP connector; the v2 GitHub-org connector is the named
   repricing trigger) · risk-register **$279** (operator pick under the flagship's $299) ·
   trust-page **$149** (bottom of range — thin by design, category ceiling compressing).
2. **Bundle membership: all three JOIN Compliance and the bundle reprices $1,049 → $1,449**
   (holds ~70% of the enlarged member subtotal — the pre-join ratio was 72.7%). Everything's
   price is unchanged; its computed savings improve with the larger catalog.
3. **Arming: NOW, full wave** — catalog rows, site display, bundle join, Paddle sandbox prices.
4. **Renovate triage:** #302 (setup-java digest) + #308 (postgres tag pin) merged on green CI;
   #303 (dependency-cruiser v18, red check) PARKED for a dedicated dep sitting.
5. **W3 mirror-public flip: HOLD stands** — the caisson-oss flip stays timed with the launch
   sequence.

## The two-consume arming sequence (execution shape, discovered against the gates)

A members pin must name an **already-published** version (the coverage invariant allows
"resolves this cut" only for a pin equal to a package's current workspace version, and the
version consume does not rewrite pin literals), and the storefront membership test treats the
registry index as the entitlement truth. Single-PR arming is therefore impossible; the sequence
that satisfies every gate — the exact #280 → #283 agent-trajectory precedent — is:

- **PR A (publish arming):** the three SKUs + `@caisson/artifact-render` flip
  publishable (`private` dropped, `publishConfig` added), keeping `sellable: false` and the
  placeholder price; kinds corrected to `primitive`; the four slugs enter
  `RESERVED_MODULE_ENTITLEMENT_IDS` for the publishing-gap window (the documented ADR-0111
  lifecycle). The agentic-dev and everything bundles repoint their agent-trajectory member pin
  0.3.0 → 0.3.4 (published + uploaded), clearing the way for the final stranded-version prune.
- **Consume 1 + train ride:** first publishes the four (at 0.2.0 via the pending wave
  changesets) — index entries exist, tarballs upload.
- **PR B (sellable + catalog flip):** manifests flip `sellable` + real `priceCents`
  (19900/27900/14900); Compliance members map gains the three at their published 0.2.0 pins and
  `priceCents` → 144900; Everything members map gains the three; pricebook `SKU_RETAIL` +
  `BUNDLE_RETAIL` (compliance 1449) + the membership-timeline `COMPLIANCE_GAP` join instants;
  site `MODULE_PRICES` rows + the $1,449 bundle display; the four slugs GRADUATE from the
  reserved set; the changed test pins (upgrade quote, $579 renewal, $2,070 stack subtotal)
  update to the new numbers.
- **Consume 2 + train ride:** republishes the bundles with membership — the index entitlement
  truth now grants the three; site claims become index-consistent.
- **Deploy tail:** Worker + site redeploys; `tools/paddle-catalog-recreate.ts` run against
  SANDBOX for the new products/prices (create-only — the repriced Compliance bundle may need an
  operator price edit in the Paddle dashboard if the tool's create-only idempotency skips it).
- **Follow-up prune:** with no served-latest pin naming agent-trajectory 0.3.0, delist it —
  noting older served bundle versions still pin it frozen in the append-only ledger, so the
  prune may require version-delisting those superseded bundle versions too (or a grandfather
  row); resolve at execution.

## Also decided in execution

- **`@caisson/artifact-render` flips from never-published to PUBLISHED, never sold**
  (`sellable: false`, the platform-reads/pricebook posture): published packages
  (compliance-core's SoA target, trust-page) declare runtime dependencies on it, and a private
  dependency of a published package is an unresolvable install range (the W1-sandbox class).
  The wave's never-published note is superseded on that ground.
