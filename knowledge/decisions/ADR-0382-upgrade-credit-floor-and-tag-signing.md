# ADR-0382 — Upgrade-credit paid floor, release-tag signing, and oscal-spine as a priced SKU

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked, same-sitting picker over the three open fork-board rows)
- **Parent:** ADR-0381 (whose lock 2 created the first of these rows) · ADR-0364 (whose F3 deferred
  the oscal-spine pricing question to the board) · ADR-0247 F8 (the upgrade-quote primitive) ·
  ADR-0007 (integer money units) · ADR-0006 (append-only migrations)

## Context

Three rows sat open on `docs/state/decisions-and-forks.md`. Each is answered here; a fourth, Railway
PITR, was not re-asked (declined 2026-07-11, reconfirmed 2026-07-18, and its stated trigger — real
commerce data raising the recovery-point bar — has not fired).

**A correction this ADR records, because it changed the shape of the first decision.** The fork row
claimed no paid amount is stored anywhere in this repo. That was wrong. `PURCHASE_BOOK` carries
none — true, and deliberate — but `order_record` has recorded `amount` with its `currency` since
migration `0019` (`services/license/src/subscription-history-store.ts:179-199`). What is genuinely
absent is a **per-SKU** amount: `order_record.amount` is `ev.amountTotal`, the whole transaction's
grand total, which cannot be split across a multi-line cart after the fact. The per-line figure has
also always been on the event as `lineItems[].chargedAmount` (`packages/billing/src/events.ts:36`,
minor units, Paddle-populated) and was simply never persisted. So the decision below is about
granularity, not about introducing money storage.

## Decisions

### 1. The paid amount lives on the entitlement grant, written at grant time

ADR-0381 lock 2 requires that an upgrade credit never fall below what the buyer actually paid. That
needs a per-owned-SKU amount. Of the two candidate homes, **persist at grant time** is locked
(operator pick, matching the recommendation) over reading it back from Paddle in the upgrade path.

- New nullable columns `charged_amount` (integer, minor units) and `charged_currency` on
  `entitlement_grant`, shipped as the tail migration `0031_entitlement_grant_charged_amount.sql`.
  A CHECK enforces non-negative, and a second CHECK enforces that the two are written as a pair.
- Minor units, matching the provider and `order_record.amount`. Never dollars, never a float
  (ADR-0007).
- `resolveUpgradeCredit(itemId, bundleId, paidMinorUnits?)` returns `max(retail, paid)`. Conversion
  to the integer USD the pricebook prices in rounds **up**: the clause is a floor, and flooring
  $149.50 to $149 would land below what the buyer paid — the exact failure the clause forbids.
- The paid amounts are an **argument** to `upgradeQuote`, never a lookup the pricebook performs. The
  pricebook stays pure and DB-free; the tenant-scoped read belongs to the license/site layer.

**The amount is recorded only when the line's charge is genuinely one SKU's price.** Otherwise the
column stays NULL, which the quote reads as "unknown" and credits at retail — the pre-0381
behaviour, and the only honest answer where no per-SKU number exists. Three conditions gate it:

- `quantity === 1` — a quantity-2 line charges twice for one binary entitlement, so its total is
  double the SKU's price.
- `chargedAmount > 0` — a driver with no per-line data (Stripe) reports 0, which means "not
  reported", not "free".
- exactly one entitlement on the line — defensive, not a live case. Every `PURCHASE_BOOK` row today
  grants exactly one id, and a **bundle is one id that expands to members downstream**, not N ids at
  grant time. The guard exists for a future combo SKU, where splitting one charge between two ids
  would be a guess.

**Timing is the substance of this lock, not a detail.** There are zero buyers, so the column starts
empty and no backfill exists. After the first sale, a purchase made without this column has no
recoverable per-SKU amount — `order_record` holds only the transaction total. The migration must
therefore land before commerce opens, not when the upgrade route is built.

**Disclosed residual.** The upgrade route is not wired: `bundleUpgradeQuote` has no caller but its
own test. The column is write-only until it is, deliberately — the write must precede the first
sale, the read need not.

**Disclosed residual.** A discounted purchase records the discounted amount, so the floor reflects
what the buyer actually paid rather than list price. That is the clause read literally. Where the
discount was an affiliate promotion, retail still applies, because the credit is `max(retail, paid)`
and the discounted amount is the lower of the two.

### 2. Release tags are signed going forward; the readiness check is advisory

`gh api .../git/tags/<sha>` reports `verified: false`, `reason: "unsigned"` on `v2026.07.20.3` and
every earlier tag. Every leg of the release train resolves the **tag** rather than a SHA — registry
publish, mirror sync, fleet redeploy — so a forged or moved tag is followed by all of them. No ADR
ever promised signing, so this is a gap rather than a broken promise. **Locked: SSH tag signing
going forward** (operator pick, matching the recommendation).

- `scripts/release-readiness.ts` gains check 0b, running `git tag -v` against the allowed-signers
  file.
- The check is **advisory, not blocking**. A tag's signature covers its own bytes, so an existing
  unsigned tag cannot become signed without being deleted and recreated — which is precisely the tag
  mutation the signature exists to prevent. A blocking check would fail the train on history it
  cannot legitimately repair. Promotion to blocking is a one-line change, to be made once the first
  signed tag has trained end to end.
- Key creation and loading are operator acts (secrets). Procedure:
  [release-tag-signing](../../docs/ops/release-tag-signing.md).

**Scope.** Tags only, not commits. This does not prevent a tag deletion; it prevents a
_valid-looking_ replacement and makes the deletion visible as a verification failure. It is not a
supply-chain attestation — provenance for published bytes stays the release record's job.

### 3. `oscal-spine` becomes a priced fourth SKU — direction locked, number outstanding

ADR-0364 F3 locked "extend in place: no new package, no new SKU" and deferred the pricing question
to the board, where the row was never filed. **Locked: it becomes a priced SKU** (operator pick,
overriding the recommendation to park it with a demand trigger).

This ADR records the **direction only**. The price itself is an operator-owned number that has not
been set, and this repo does not invent prices. It is filed as a distinct decision rather than left
as a blank in this one, so that neither has to be edited later (ADR-0006 append-only).

Consequences that follow from the direction, and that the pricing decision must account for:

- The axis has **no package boundary today**. It shipped (PR #278, `d233afe0`) as mapping data plus
  a vendored NIST catalog in `frameworks-pack`, and a generator plus drift-check in
  `compliance-core`. A SKU in this catalog is a package — every `SKU_RETAIL` key is one — so pricing
  it requires carving `@caisson/oscal-spine` out of two existing packages, with its own manifest,
  license classification, registry entry, and changeset.
- It reopens a **frozen catalog**. Production recreation is planned at exactly 35 products and 66
  prices, and the launch runbook gates on that count. A fourth compliance-gap SKU moves it, and
  every consumer of the catalog/fulfillment parity check moves with it.
- Bundle membership is a separate question from price. If it joins Compliance's `members`, the
  below-sum invariant (`upgrades.test.ts` pins bundle retail < Σ member retail) must still hold at
  $1,449, which ADR-0381 lock 2 froze.

Until the number is set, the fork-board row stays **open** with its direction recorded.

## Consequences

- `entitlement_grant` gains two nullable columns and the platform chain gains `0031`. Applying it is
  an **external-system/data-migration act** and stays behind the operator hold — Act 1 of the launch
  runbook already sequences migration application, and `0031` rides the same gate as `0030`.
- Four integration suites and two migration goldens move with the new tail entry; the pre-extraction
  digest proof is untouched by construction, because it filters to the historical prefix rather than
  re-pinning.
- `upgradeQuote` and `bundleUpgradeQuote` gain an optional third parameter. Both are
  backward-compatible: every existing call site credits at retail exactly as before.
- The release train reports tag signature status on every run and fails on none of them yet.
- The `oscal-spine` pricing decision is owed a successor ADR carrying the number, the package carve,
  and the catalog-count change.

## Not decided here

- Railway PITR — not re-asked; declined twice, trigger unfired.
- Commit signing — out of scope; only tags were in question.
- Whether `oscal-spine` joins a bundle's `members`, and at what price. Successor ADR.
