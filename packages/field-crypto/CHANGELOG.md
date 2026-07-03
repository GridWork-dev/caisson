# @caisson/field-crypto

## 0.2.1

### Patch Changes

- 081a1d8: Live seams: cloud-KMS envelope proof + ONNX EgressGuard unification (ADR-0221, extends ADR-0201).

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

- f9d58c4: Post-wave-hardening triage Bucket B (CAISSON-10/11/12/13), test and proof hygiene, no
  runtime behavior change for buyers.

  - CAISSON-12: root bunfig.toml scopes bun test discovery away from stale compiled dist/
    output, plus a regression test in @caisson/testing.
  - CAISSON-11: apps/admin's PGlite bootstrap now applies the ADR-0218 line-item migrations
    (0008/0009), matching the deploy-migrate chain, plus a columns-contract-style parity test.
  - CAISSON-13: packages/field-crypto's live KMS proof schedules deletion for both throwaway
    CMKs defensively in afterAll, not just the one the last leg reached.
  - CAISSON-10: apps/admin's /business degrade path distinguishes a genuine undefined-table
    error (Postgres 42P01) from any other transient DB error before rendering the
    provisioning hint.

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
