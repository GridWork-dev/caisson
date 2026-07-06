# @caisson/billing

## 0.4.1

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.4.0

### Minor Changes

- fb8d966: Dual-layer billing-webhook idempotency. New exports:
  `PROCESSED_EVENT_SCHEMA_SQL` (a `billing_processed_event` claim table — tenant-owned FORCE-RLS,
  non-blank account guard, shipped as a new checksum-pinned platform migration string, never an edit to
  a shipped one); `processEvent(tx, sourceEventId, fn)` (OUTER layer — claim the whole event once via
  `INSERT ... ON CONFLICT DO NOTHING RETURNING`, so a re-delivery skips the grant AND leaves no granted
  entitlements to trigger the post-commit Discord push, so a re-delivered event cannot re-fire it); and
  `withIdempotentSideEffect(tx, sourceEventId, sideEffect, fn)` (PER-SIDE-EFFECT layer). Both run inside
  the caller's `withTenant` tx so the claim commits atomically with the grant. The credit ledger stays
  the idempotent inner backstop; adds `@caisson/tenancy-rls` as a dependency.

### Patch Changes

- cc7cb8b: Live-verification harness: self-skipping `live/` proofs for the
  five production-wired external seams, run after a launch key rotation to prove the rotated
  credentials work end-to-end. Test files + `test:live` scripts only — no product code changed.

  billing carries seam 1's `live/paddle-webhook.live.test.ts` (a webhook simulator plus Playwright legs
  against the real Paddle surface); the other four seams live under `services/*` and `apps/*`
  (exempt) plus the support-bot pytest `live` marker. No runtime behavior change for buyers.

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.3.0

### Minor Changes

- aaff518: Paddle per-line partial refund — per-line entitlement revoke + per-line credit clawback (ADR-0218,
  supersedes the ADR-0113 full-refund-only clause). Refunding ONE line of a multi-item Paddle cart is
  no longer a full no-op.

  `@caisson/billing`: the shared `DomainBillingEvent` gains provider-agnostic per-line refund shape
  (fork D-2 shape / D-1 population). `purchase.completed.lineItems[]` carries each line's `itemId`
  (Paddle `txnitm_…` join key from `details.line_items[].id`) + `chargedAmount` (the proportional-
  refund divisor); `refund.completed` gains `adjustmentId` (the per-line clawback idempotency anchor)
  and an `items[]` per-line array. The Paddle mapper populates them (correlates `items[]` with
  `details.line_items[]` by order; parses a partial adjustment's `data.items[]`, skipping Paddle-
  generated `tax`/`proration` items); Stripe/Polar/LemonSqueezy one-entry-wrap with empty sentinels
  (no real per-line refund data).

  `@caisson/credits`: `grant` accepts a per-line `lineItemId` + `lineChargedAmount`; `clawback`
  accepts a per-line `lineItemId` + rounding provenance; new `lineCreditLedger` reads a line's
  granted/clawed/charged totals so a per-line refund never over-claws past that line's grant onto
  other lines' fungible balance. New `CREDIT_LINE_ITEM_MIGRATION_SQL` adds the nullable
  `line_item_id` / `line_charged_amount` columns (fork C-b) and folds `COALESCE(line_item_id, '')`
  into `credit_event_source_uniq` so a multi-item cart's N per-line `purchase` rows stay distinct
  (integer money + round-down provenance per ADR-0007/0212).

### Patch Changes

- 20d5ab0: Stripe webhook envelope hardening (ADR-0210): `provider.ts`'s Stripe driver used to trust
  the raw webhook body via a bare `JSON.parse(rawBody) as StripeEvent` cast — a type-level
  assertion with no runtime shape check. Signature verification already ran first, but a
  validly-signed, malformed-envelope delivery (missing/wrong-typed `id`, or an unexpected
  top-level field) flowed straight into the mapper. `StripeEventSchema` (`strictObject`,
  mirroring `PaddleEventSchema`) is now wired into `verifyAndParse` via `parseStrict`, closing
  the gap Paddle/LemonSqueezy/Polar already closed — all four `BillingProvider` drivers now
  parse through a strict envelope schema before their mapper runs. `data.object` stays a loose
  `Record<string, unknown>` (the existing `read*` helpers are the defensive layer for it,
  unchanged). No change to `verifyAndParse`'s call order, the `BillingProvider` port shape, or
  Stripe driver activation state (ADR-0200: still dormant). New export: `StripeEventSchema`.
- 95103b6: Money-path hardening. `parsePaddleEvent` now correlates
  `items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
  closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
  optional `onWarn` callback, threaded all the way from `PaddleConfig` through `verifyAndParse` and
  wired to `services/license`'s stderr telemetry, instead of a silent skip. `@caisson/credits` gains
  `creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound BOTH a
  whole-transaction `type:full` refund claw AND a per-line partial claw to the purchase's
  granted-minus-already-clawed remainder regardless of delivery order, never spilling onto another
  purchase's credits. `@caisson/tenancy-rls` gains `buildAdminSelectPolicySql`, a SELECT-only
  cross-tenant policy variant; `services/license`'s admin mutation surface now uses it (rather than the
  write variant) for its read-only `account_member` existence check, and (`grantEntitlementAdmin` /
  `adjustCreditsAdmin`) fails closed with a 404 on a nonexistent target account, rolling back the whole
  transaction before any entitlement or credit row commits.
- 549dd4e: Security hardening pass. kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, defending against DNS rebinding. alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first, plus a `subscription_update` regression test guarding against a proration event being credited as a full purchase.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- 5b57c78: Fold in the 2026-07-01 Paddle-docs adversarial verification (all claims checked against
  developer.paddle.com): the signature timestamp tolerance now matches Paddle's documented SDK default
  of 5 seconds (was Stripe's 300s, a silent 5-minute replay envelope); transaction `origin` maps
  correctly — `web`/`api` = the subscription's first charge → `subscription_create`,
  `subscription_recurring` → `subscription_cycle`, and `subscription_charge` (a MID-CYCLE one-time
  charge, not the first charge) is now non-granting, closing an over-grant of a full cycle allotment;
  the cycle idempotency anchor is the transaction id (Paddle documents `invoice_id` as deprecated and
  scheduled for removal).
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
