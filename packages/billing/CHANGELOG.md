# @caisson/billing

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
