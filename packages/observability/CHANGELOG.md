# @caisson/observability

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

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- 6236f59: Add `@caisson/platform-reads` (new): shared typed read-only queries over the
  services/license cross-service tables (`entitlement_grant` / `license_grant`), so the
  buyer dashboard (apps/site) and any other surface reading those tables imports the typed
  reader instead of hand-copying raw SQL — a column rename now fails the columns-contract
  test instead of silently desyncing at runtime.

  Update `@caisson/observability` (ADR-0117): the vendor-neutral OpenTelemetry bootstrap
  (env-gated NodeSDK + OTLP/HTTP exporter, HTTP/fetch/pg auto-instrumentation, and
  span-attribute scrubbing).

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
