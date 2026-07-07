# @caisson/field-crypto

## 0.3.0

### Minor Changes

- 8c53ca3: field-crypto ships a real GCP Cloud KMS driver (`createGcpKmsClient`) beside
  the existing AWS driver: injected config, `ConfigError` fail-closed, per-tenant CryptoKey targeting
  with an `additionalAuthenticatedData` scope binding, and version-scoped crypto-shred via
  `destroyCryptoKeyVersion`. Registered in the shared `KmsClient` port-conformance suite; a self-skipping
  `live/kms-gcp.live.test.ts` proves the real adapter stack end to end against a throwaway per-run
  CryptoKey (GCP KeyRings/CryptoKeys can't be deleted, so the fixture KeyRing is pre-provisioned via
  `CAISSON_KMS_GCP_KEY_RING`; only the CryptoKey and its primary version are minted/destroyed per run).

  ai-config's provider lane enum gains three named OpenAI-compatible vendors — `groq`, `mistral`,
  `together` — following the same `apiKeyEnv`-required rule as `openai`/
  `openrouter`. ai-kit's `providerFor` wires all three over `createOpenAICompatible` with a hardcoded
  default `baseUrl` per vendor (Groq `https://api.groq.com/openai/v1`, Mistral
  `https://api.mistral.ai/v1`, Together `https://api.together.xyz/v1`, each overridable), and fails
  closed when the named `apiKeyEnv` resolves to no value (these are paid vendor APIs, unlike the
  `local`/`ollama` placeholder key).

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- cf66d65: Hardened row-level security on the key-version and wrapped-key tables: the tenant-isolation
  check now discards an empty-string tenant identifier before comparing it against a row's
  tenant column, instead of comparing against it directly. This closes a narrow gap where
  certain connection-pooling configurations can leave a database session with an empty string
  instead of a properly cleared value, which previously could coincide with a real row's tenant
  column and let it be read. Shipped as a follow-up migration alongside the original table
  migration, so existing installs pick up the hardening on their next migrate run without any
  data loss or re-encryption.
- cf66d65: Documented and test-hardened the key-rotation contract for encrypted fields: rotating a
  tenant's key version never requires re-encrypting existing data. Every stored value already
  carries the key version it was written under, so old rows keep decrypting under their original
  key while new writes pick up the current one automatically. Added an explicit test proving the
  rotated key is actually different key material (not just a different version label) and a
  doc comment spelling out the no-remigration guarantee for anyone implementing a custom key
  provider.
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

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

- f9d58c4: Test and proof hygiene, no runtime behavior change for buyers: the live KMS proof
  now schedules deletion for both throwaway CMKs defensively in `afterAll`, not just the one
  the last leg reached.

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
