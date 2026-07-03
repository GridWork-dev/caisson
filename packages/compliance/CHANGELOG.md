# @caisson/compliance

## 0.3.0

### Minor Changes

- 93770dd: OSCAL Assessment-Plan rlink: author the 3 per-framework AP documents + a signed evidence bundle. New `toOscalAssessmentPlan(framework)` emits a minimal-but-valid OSCAL v1.2.2
  `assessment-plan` per framework (deterministic via the injected now/newId seam), and a new
  `assembleOscalEvidenceBundle()` lays out a sibling-directory bundle (`./assessment-plan/<fw>.json`,
  `./sar.json`, `./poam.json`, `./manifest.json`, `./manifest.sig`), rewriting the SAR back-matter
  `rlink.href` to the RELATIVE in-bundle AP path with a SHA-256 `hashes[]` binding over the
  canonicalized AP bytes and reusing `signEvidencePack()` unchanged. `OscalExportOptions` gains an
  `assessmentPlan { rlinkHref; sha256? }` seam; the `assessmentPlanHref` buyer override is untouched;
  the OSCAL conformance gate now validates each AP at v1.2.2 (skip-if-absent). Replaces the dead
  absolute `caisson.sh/oscal/assessment-plan` URL as the emitted default.

### Patch Changes

- fb8d966: Control-to-code traceability idiom — a convention, not a framework: the
  `soc2Tsc` pack export cites its governing policy decision record in its docstring, and a
  `control-traceability` golden exemplar pins the `policyVersion` a control-logic fixture was captured
  under. No runtime/schema change; existing
  catalog goldens byte-stable.
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/retention-runner@0.1.3
  - @caisson/alerting@0.1.3
  - @caisson/audit-worm@0.2.2
  - @caisson/field-crypto@0.2.2
  - @caisson/migrate@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [95103b6]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/alerting@0.1.2
  - @caisson/audit-worm@0.2.1
  - @caisson/migrate@0.2.1
  - @caisson/retention-runner@0.1.2

## 0.2.0

### Minor Changes

- Compose @caisson/alerting and @caisson/retention-runner into the edition surface (ADR-0205, closing the ADR-0178 manifest-vs-composition gap): a createComplianceEdition() factory binds both pipelines to audit sinks with safe defaults, the barrel re-exports both packages (retention's CaptureAuditSink aliased as RetentionCaptureAuditSink), and the manifest declares both as runtime dependencies.
- 59d332f: Edition seam-completion (ADR-0179..0185).

  - `@caisson/compliance`: OSCAL export lifted to v1.2.2 with a JSON→XML converter path (`oscal-export-xml`)
    and NIST-conformant SAR + POA&M output across all three frameworks (SOC2/HIPAA/EU-AI-Act) — finding
    status carries a constrained token + `remarks`, POA&M satisfies the `poam-items` min-1 XSD rule with a
    truthful "no open items" entry rather than a fabricated gap, and the root `props` block is dropped. Adds
    the AI-risk-register + field-crypto-policy collectors.
  - `@caisson/ai-kit`: BYOK key resolver (free-tier + edge-safe).
  - `@caisson/observability`: manual Bun-OTel request spans (`request-span`).
  - `@caisson/pricebook`: seam action export.

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

- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- fcd5131: De-flake the `oscal-conformance` gate: the JSON→XML→validate round-trip test does two JVM `oscal-cli`
  spawns (convert + validate), whose cold-JVM startup can exceed bun's 5s default test timeout on a slow CI
  runner (observed 5001ms on the `assessment-results` leg). Add a 60s per-test timeout. Test-only; no
  runtime behavior change.
- Updated dependencies [33bee35]
- Updated dependencies [72ffd85]
- Updated dependencies [57170c5]
- Updated dependencies [69817a1]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/alerting@0.1.1
  - @caisson/retention-runner@0.1.1
  - @caisson/field-crypto@0.2.0
  - @caisson/audit-worm@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/migrate@0.2.0
  - @caisson/tenancy-rls@0.2.0
