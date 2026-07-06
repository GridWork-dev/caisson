# @caisson/observability

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- 904b15b: Repointed internal doc links to their current locations, re-globbed the design-ui audit domain to the current admin app, and updated the observability vendor reference to the current fleet sink. Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

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

- 72ffd85: Request spans now use low-cardinality span names with the HTTP route scrubbed before export.
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
