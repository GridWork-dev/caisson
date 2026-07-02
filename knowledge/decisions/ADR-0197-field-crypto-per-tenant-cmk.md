# ADR-0197 — field-crypto AWS KMS driver honors per-tenant CMKs (crypto-shred blast radius)

**Status:** accepted · 2026-07-01 (whole-repo audit remediation — operator lock, picker round 2026-07-01).
**Relates:** ADR-0057 (field-crypto/evidence controls), ADR-0071 (entitlements), ADR-0134/0188 (the audit
harness that surfaced it), ADR-0171 (AWS KMS + DB wrapped-key store adapter).

## Context

Audit round 2 (finding `1665248bff049c36`) confirmed the AWS KMS driver
(`packages/field-crypto/src/kms-aws.ts`) silently ignored the per-call tenant `keyId`: every
operation — including `scheduleKeyDeletion` — targeted the single configured CMK. A per-tenant
crypto-shred (the GDPR Art. 17 upsell the edition sells) would have destroyed every tenant's key
material at once. The AWS path is un-exercised in CI (LocalKms carries the tests), so no gate could
catch it. Triage filed this as a fork: build per-tenant CMK support now vs defer to the first AWS
customer.

## Decision

Build now. The driver honors the per-call `keyId` end-to-end: every operation targets the key passed
for that call, falling back to the configured default CMK only for non-destructive operations.
`scheduleKeyDeletion` **refuses** (throws) when no explicit `keyId` is supplied — shredding the shared
default key is exactly the blast-radius bug. Tenant identity is bound into the KMS
`EncryptionContext`, mirroring the envelope layer's AAD scoping, so a data key wrapped for tenant A
cannot be unwrapped under tenant B's context. LocalKms keeps the identical port semantics so the
contract stays uniform and testable.

## Rejected

- **Defer to first AWS customer** — the defect is a data-destruction class; shipping a known
  all-tenants shred path in a compliance product is indefensible even unexercised.
- **Separate per-tenant driver class** — the port already passes `keyId` per call; honoring it is
  strictly smaller than a parallel driver.
