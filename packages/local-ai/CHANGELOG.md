# @caisson/local-ai

## 0.2.8

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/field-crypto@0.3.3
  - @caisson/license-verify@0.3.3
  - @caisson/local-inference@0.1.4
  - @caisson/local-privacy@0.1.4
  - @caisson/local-store@1.0.2
  - @caisson/local-sync@0.1.4

## 0.2.7

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/field-crypto@0.3.2
  - @caisson/license-verify@0.3.2
  - @caisson/local-inference@0.1.3
  - @caisson/local-privacy@0.1.3
  - @caisson/local-store@1.0.1
  - @caisson/local-sync@0.1.3

## 0.2.6

### Patch Changes

- 2b65cf3: Drop the stale test:live script left behind by the inference carve — the package has no live/
  directory, so the empty filter exited 1 and killed the whole live-harness turbo fan-out. The
  live transport proofs live in the inference package's own harness.
- Updated dependencies [317bad5]
- Updated dependencies [2b65cf3]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [8253e76]
  - @caisson/license-verify@0.3.1
  - @caisson/kernel@0.4.3
  - @caisson/local-store@1.0.0
  - @caisson/field-crypto@0.3.1
  - @caisson/local-inference@0.1.2
  - @caisson/local-privacy@0.1.2
  - @caisson/local-sync@0.1.2

## 0.2.5

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/field-crypto@0.3.0
  - @caisson/local-inference@0.1.1
  - @caisson/local-privacy@0.1.1
  - @caisson/local-sync@0.1.1

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- bc12f3a: Carve local-first privacy, inference, and sync into separately priced commercial modules.
- 9efcff2: Export verifyLicenseWithKey from the edition surface so reference applications and tests can
  exercise offline license verification against an explicit public key instead of the baked
  production key.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [bc12f3a]
- Updated dependencies [2834c3f]
- Updated dependencies [90b6dc1]
- Updated dependencies [f178f9a]
- Updated dependencies [9efcff2]
- Updated dependencies [4d7eb71]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [4d7eb71]
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/license-verify@0.3.0
  - @caisson/local-store@0.2.4
  - @caisson/local-inference@0.1.0
  - @caisson/local-privacy@0.1.0
  - @caisson/local-sync@0.1.0

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/license-verify@0.2.3
  - @caisson/local-store@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/field-crypto@0.2.2
  - @caisson/license-verify@0.2.2
  - @caisson/local-store@0.2.2

## 0.2.1

### Patch Changes

- 081a1d8: Live seams: cloud-KMS envelope proof + ONNX EgressGuard unification (ADR-0221, extends ADR-0201).

  field-crypto: a gated `live/kms.live.test.ts` (`test:live`) drives the real adapter stack —
  `createAwsKmsClient` → `KmsKeyProvider` → `TenantFieldCrypto.encryptField/decryptField` →
  `cryptoShred` — against freshly minted, throwaway AWS CMKs: envelope round-trip through a real
  wrapped DEK, per-tenant CMK isolation, and a real crypto-shred verified by an independent
  `DescribeKey` (the first live exercise of the ADR-0197 blast-radius fix). Self-skips without
  `CAISSON_KMS_LIVE` + AWS creds; no `src/` change (print-only `infra/kms/provision.ts` emits the
  tag-scoped prover statements to add to the shared WORM prover).

  local-ai: the ONNX backend's inline `#guardedFetch` host/scheme check is unified onto the shared
  `EgressGuard` (`model-fetch` sink kind) so the model-fetch and rented lanes prove egress at the
  same shared-policy layer; the SHA-256 hash-pin stays inline. The `onnx.live.test.ts`
  egress-block leg now asserts the shared-guard fail-closed, plus a new guard leg mirroring the rented
  lane's `liveGuard()`.

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [081a1d8]
- Updated dependencies [623d07c]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/local-store@0.2.1
  - @caisson/field-crypto@0.2.1
  - @caisson/license-verify@0.2.1

## 0.2.0

### Minor Changes

- 57170c5: Editions go live (ADR-0187 + ADR-0201/0202): live transports proven + retention escalation + support impersonation.

  - `@caisson/audit-worm`: `extendRetention` on the `ArtifactStore` port (strictly-monotonic, never
    shortens — ADR-0202), `escalateToCompliance` on the S3 backend behind the ADR-0051 three-belt gate,
    and the chain-evidenced `escalateRetention` helper (`retention.escalated` on the tenant chain;
    a chain-append failure fails the whole operation loudly). Live S3 Object-Lock proof in `live/`
    (`test:live`, self-skipping — ADR-0201).
  - `@caisson/ai-kit`: `openrouter`/`local`/`ollama` provider lanes moved to
    `@ai-sdk/openai-compatible`, fixing the AI SDK v5 Responses-API default that would have POSTed
    live calls to `{baseURL}/responses` instead of `/chat/completions`; a baseUrl-less `local`/`ollama`
    lane now fails closed instead of silently calling api.openai.com. Live gateway proof in `live/`.
  - `@caisson/local-ai`: `createOpenRouterRentedTransport` — the hosted (non-BYOK, fully-metered)
    rented lane over OpenRouter's OpenAI-compatible wire, egress-guarded and strict-revalidated.
    Live rented + availability-gated ONNX proofs in `live/`.
  - `@caisson/compliance`: the support-impersonation kernel with a dual audit trail (ADR-0187) —
    time-bounded, reason-required sessions; operator + acting-as-tenant records linked by `sessionId`
    on the target tenant's WORM-anchored chain; `impersonation_session` migration (RLS + column-scoped
    GRANT); the impersonation evidence collector cited by both the SOC2 and HIPAA plans.

- Azure OpenAI and AWS Bedrock RentedTransport drivers beside OpenRouter (ADR-0209): Bedrock signs invoke/converse with a hand-rolled, vector-pinned SigV4 on node:crypto (no AWS SDK); Azure uses api-key auth on the GA deployments surface. Both run through the egress-guard chokepoint with strict-mapped wire schemas and optional self-skipping live probes. Ollama stays out of the rented seam by design.
- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/field-crypto@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/license-verify@0.2.0
  - @caisson/local-store@0.2.0
