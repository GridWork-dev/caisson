# ADR-0346 — External-anchoring PLAN locks: full CMS verification, local TSA port, license-service scheduler, PG outbox, deployment anchoring key, OTS as code

Status: accepted · 2026-07-13 (operator picker rounds over `outputs/plans/external-anchoring/PLAN.md` §5 + `PLAN-rekor-v1.1.md` §5; extends ADR-0332)

## Decision — v1 (TSA leg)

1. **Fork P2 — verification depth: FULL ASN.1/CMS dependency NOW (overrides the seam-first
   recommendation).** v1 lands a vetted ASN.1/CMS dependency (pkijs/asn1js class) for complete
   TimeStampToken DER parsing + TSA certificate-chain validation in `verifyExternal`, not just
   imprint-recompute + structural parse. Consistent with the GATE-1 posture (ADR-0344): the
   operator buys verification strength over scope. The dependency choice gets its own supply-chain
   review at EXECUTE (new crypto dep family on a sold package — `security` tag, pinned per the
   repo's discipline).
2. **Fork P1 — TSA port: reimplemented locally in audit-worm** (~40 lines mirroring the sign.ts
   RFC-3161 pattern). Preserves audit-worm's down-only dependency set; no members-pin republish
   churn.
3. **Fork P3 — checkpoint scheduler host: services/license** (the in-repo pg-boss home — the
   anchoring tick registers beside the expiry sweeps; no new boot infrastructure).
4. **Fork P4 — durable outbox: a dedicated `anchor_outbox` Postgres table** with tenant RLS +
   the admin_write policy. States persisted BEFORE egress; response loss resolves to
   `needs_reconcile` surfaced to the operator — never a blind retry into a duplicate public entry.

## Decision — v1.1 (Rekor leg)

5. **Fork R-α — signer model: a DEPLOYMENT-LEVEL ed25519ph anchoring key**, not per-tenant
   binding. Trust comes from log inclusion; anchor bytes already commit each tenant chain via
   tipHash. Eliminates background-job access to BYOK/KMS/crypto-shredded tenant keys and the
   tenant-key-unavailable fail mode. Supersedes ADR-0332's per-tenant-signer framing at the
   MECHANICS level (the spike proved hashedrekord rejects pure Ed25519 regardless — Ed25519ph is
   required, so a new signing surface was inevitable either way). ECDSA-P256 dedicated key stays
   the documented fallback if the R1 ed25519ph interop de-risk fails.
6. **Fork R-γ — OpenTimestamps: SHIPPED AS MINIMAL CODE in v1.1** behind the same
   TransparencyLog port (signature/verifier fields unused). The safer-to-ship-first
   externally-transparent proof: no per-entry signature, idempotent-ish submission, free
   aggregation — proves the grade end-to-end independent of Rekor interop risk.
7. Fork R-β (sigstore libs vs hand-roll) stays EVIDENCE-RESOLVED by the R1 de-risk task, per the
   PLAN — not a taste lock; surface R1's outcome to the operator.
