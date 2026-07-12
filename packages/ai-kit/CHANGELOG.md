# @caisson/ai-kit

## 0.4.1

### Patch Changes

- Updated dependencies [1bc677a]
- Updated dependencies [230f02a]
- Updated dependencies [a79acb4]
- Updated dependencies [2b65cf3]
- Updated dependencies [7df836a]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [1bc677a]
  - @caisson/ai-meter@1.0.0
  - @caisson/credits@0.5.0
  - @caisson/guardrails@0.4.3
  - @caisson/kernel@0.4.3
  - @caisson/ai-config@0.3.1
  - @caisson/tenancy-rls@0.5.1
  - @caisson/prompt-registry@1.0.0
  - @caisson/field-crypto@0.3.1

## 0.4.0

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

### Patch Changes

- The two retired-alias meta packages now advertise their alias target's locked bundle price in
  the registry manifest ($739 for the AI Production Kit, $329 for Agentic-Dev), replacing the
  old pre-launch placeholder numbers. Purchasing behavior is unchanged — both ids keep resolving
  to their bundles exactly as before.
- Updated dependencies [8c53ca3]
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/field-crypto@0.3.0
  - @caisson/ai-config@0.3.0
  - @caisson/tenancy-rls@0.5.0
  - @caisson/credits@0.4.1
  - @caisson/guardrails@0.4.2
  - @caisson/ai-meter@0.3.4
  - @caisson/prompt-registry@0.2.5

## 0.3.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 4d7eb71: Test-double bootstrap sweep for the credit-expiry migrations: every credit-table
  bootstrap now applies `CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (the
  `debit()` FIFO path reads `expires_at` and writes `grant_consumption`). No runtime source change
  in these packages.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [dec93f3]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/ai-config@0.2.4
  - @caisson/ai-meter@0.3.3
  - @caisson/credits@0.4.0
  - @caisson/field-crypto@0.2.4
  - @caisson/guardrails@0.4.1
  - @caisson/kernel@0.4.2
  - @caisson/prompt-registry@0.2.4
  - @caisson/tenancy-rls@0.4.0

## 0.3.0

### Minor Changes

- cf66d65: Added `structuredGenerate<T>()`, a typed wrapper around the metered inference call for
  callers that want a parsed, schema-validated JSON value instead of raw model text. Pass a
  Zod schema and it returns `{ value, raw }` on success; on an empty completion, malformed
  JSON, or a schema mismatch it throws a typed `StructuredGenerateError` (with a `reason` of
  `refusal`, `invalid_json`, or `schema_mismatch`) instead of silently handing back an empty
  or unusable result. This closes a class of bug where a blocked or malformed model response
  was easy to miss because nothing failed loudly.

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/guardrails@0.4.0
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/ai-config@0.2.3
  - @caisson/ai-meter@0.3.2
  - @caisson/credits@0.3.2
  - @caisson/prompt-registry@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/ai-config@0.2.2
  - @caisson/ai-meter@0.3.1
  - @caisson/credits@0.3.1
  - @caisson/field-crypto@0.2.2
  - @caisson/guardrails@0.3.1
  - @caisson/prompt-registry@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- 5fd31fe: streaming-path test coverage
- 44a6414: Fetch-deadline floor fix + metered embeddings (ADR-0213, harden-in-place ADR-0210): every live
  `@ai-sdk/*` provider factory now binds its outbound `fetch` to a configurable `timeoutMs` (default
  60s, via `fetchWithTimeout`) instead of the ambient global fetch, closing a hang/DoS-adjacent gap on
  every provider path; `infer()`'s `generateText` now forwards `opts.abortSignal`, mirroring
  `inferStream()`'s existing wiring. New `embed()`/`embedMany()` join the gateway through the SAME
  ai-meter reserve-before/reconcile-after chokepoint, provider-agnostic via the ai-config lane and
  BYOK-routed — a metered, buyer-facing embeddings surface for RAG/semantic-search built on the proved
  registry-resolver/reserve/reconcile machinery, no guardrails or prompt-registry render (an embed input
  feeds a vector index, not a moderated chat turn). Zero diff in `@caisson/ai-config`,
  `@caisson/ai-meter`, or `@caisson/pricebook` — a bundled embedding price-book row / bulk-embed SKU is
  cross-package money, deferred to a later release.
- ccf8b10: Branded money types + rounding provenance (ADR-0212).
  Kernel gains `src/money.ts`: TS-native nominal `Cents`/`Credits`/`MicroUsd`/`MicroUsdPerCredit`
  brands (compile-time only, zero runtime cost), `asCents`/`asCredits`/`asMicroUsd`/
  `asMicroUsdPerCredit` constructors (throw `ValidationError` on a non-integer/negative input),
  the identity `unwrapMoney` DB-boundary marker, and the `RoundedMoney<TRaw,TResult>`
  `{raw, mode, result}` record; `centsToCredits` now returns `Credits` and
  `centsToCreditsProvenance` returns the round-DOWN provenance record. Credits: `GrantInput`/
  `DebitInput.amount` are `Credits`, both accept optional `rounding`, and the new
  `CREDIT_ROUNDING_MIGRATION_SQL` (appended as platform migration `0007_credit_rounding.sql` —
  never an edit to the checksum-pinned `CREDIT_SCHEMA_SQL`) adds nullable
  `rounding_raw`/`rounding_mode` to `credit_event` with a biconditional + mode-enum CHECK.
  Pricebook: `creditsPerCycle`/`credits`/`codegenRunCredits` are branded; re-exports
  `centsToCreditsProvenance`. ai-meter: `CostBreakdown` is branded and gains `roundingCredits`
  (`mode: "up"`, ADR-0060) which `reserve()`/`reconcile()` persist onto their ledger rows;
  `BUNDLED_PRICE_BOOK` gains the `openai/text-embedding-3-small` row (ADR-0213 —
  embedding pricing is config, not code; `PRICE_BOOK_VERSION` bumped to 2026-07-02).
  `apply-billing-event` grants stay exact table integers with NULL/NULL provenance
  (ADR-0089 §5); ADR-0007 integer-at-rest is untouched. ai-kit/cli: boundary mints +
  test fixture updates only.
- 549dd4e: Strix pentest remediation (ADR-0204). kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, the DNS-rebinding defense (vuln-0004). alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first (vuln-0005), and a `subscription_update` regression test (vuln-0002).
- Updated dependencies [b5915e0]
- Updated dependencies [9558a46]
- Updated dependencies [959e555]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/ai-config@0.2.1
  - @caisson/ai-meter@0.3.0
  - @caisson/guardrails@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/prompt-registry@0.2.1

## 0.2.0

### Minor Changes

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

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 33bee35: Whole-repo audit round-4 remediation (ledger 2026-07-01): BYOK (tenant-key) inference now
  makes zero wallet movement while internal metering still runs, implementing ADR-0182/0198;
  provider-unreported token usage is kept distinct from genuine zero so reconcile settles at
  the reserved estimate instead of silently refunding a real call; the spend-window bucket is
  fixed at reserve and reused at reconcile so boundary-straddling calls no longer undercount
  the hard-cap breaker. Alerting webhook/Slack/Telegram destinations get an https-only +
  private/metadata-range SSRF guard at both the Zod boundary and the fetch seam, mirroring the
  ai-kit baseUrl policy. The retention_audit table gets fail-closed RLS via an append-only
  follow-up migration. The pg-boss production job driver now validates task name + payload
  schema on enqueue like its sibling drivers.
- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- Updated dependencies [22077d1]
- Updated dependencies [33bee35]
- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/guardrails@0.2.0
  - @caisson/prompt-registry@0.2.0
  - @caisson/ai-meter@0.2.0
  - @caisson/field-crypto@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/ai-config@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/tenancy-rls@0.2.0
