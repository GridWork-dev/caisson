---
"@caisson/field-crypto": patch
"@caisson/local-ai": patch
---

Live seams: cloud-KMS envelope proof + ONNX EgressGuard unification (ADR-0221, extends ADR-0201).

field-crypto: a gated `live/kms.live.test.ts` (`test:live`) drives the real adapter stack —
`createAwsKmsClient` → `KmsKeyProvider` → `TenantFieldCrypto.encryptField/decryptField` →
`cryptoShred` — against freshly minted, throwaway AWS CMKs: envelope round-trip through a real
wrapped DEK, per-tenant CMK isolation, and a real crypto-shred verified by an independent
`DescribeKey` (the first live exercise of the ADR-0197 blast-radius fix). Self-skips without
`CAISSON_KMS_LIVE` + AWS creds; no `src/` change (print-only `infra/kms/provision.ts` emits the
tag-scoped prover statements to add to the shared WORM prover, KMS-1=A1 / KMS-2=B2).

local-ai: the ONNX backend's inline `#guardedFetch` host/scheme check is unified onto the shared
`EgressGuard` (`model-fetch` sink kind, F2=B) so the model-fetch and rented lanes prove egress at the
same shared-policy layer; the SHA-256 hash-pin (TM-MODEL) stays inline. The `onnx.live.test.ts`
egress-block leg now asserts the shared-guard fail-closed, plus a new guard leg mirroring the rented
lane's `liveGuard()`.
