# @caisson/local-ai

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

- Azure OpenAI and AWS Bedrock RentedTransport drivers beside OpenRouter (ADR-0209): Bedrock signs invoke/converse with a hand-rolled, vector-pinned SigV4 on node:crypto (no AWS SDK — Gate-2); Azure uses api-key auth on the GA deployments surface. Both run through the egress-guard chokepoint with strict-mapped wire schemas and optional self-skipping live probes. Ollama stays out of the rented seam by design.
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
