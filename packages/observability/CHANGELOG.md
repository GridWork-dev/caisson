# @caisson-sh/observability

## 0.3.10

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/kernel@0.10.1

## 0.3.9

### Patch Changes

- 87b07c6: Redact camelCase, snake_case, plural, numbered, fused and fullwidth PII attribute keys. The span
  attribute deny-list's word-boundary terms could not see a boundary inside `userEmail` or
  `user_email`, so PII-named span attributes reached the OTLP sink unredacted. `isSensitiveAttributeKey`
  is the new predicate: it NFKC-normalizes the key and tests the deny-list against both the raw key and
  a camelCase/snake_case word split; the raw `SENSITIVE_ATTRIBUTE_KEY` export is deprecated for direct
  use. The kernel deep scrubber gains the same camelCase split for its anchored `dob`/`mrn` tokens.
  Both splitters are linear in the key length.
- 9cb7681: Span-attribute scrub: an exact OTel semantic-convention attribute name no longer trips the credential terms of the key deny-list. `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `session.id`, `mcp.session.id` and 15 other real attribute names were reaching the OTLP sink as `[REDACTED]`, blanking LLM usage and session correlation. The exemption is exact-match only and never reaches the PII arm, so `user.email` and `user.full_name` (also semconv names) still redact, as do header templates, case variants, and anything the package does not export. The suite now sweeps the package's full exported name set.
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 0.3.8

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0

## 0.3.7

### Patch Changes

- 98bf1f3: Routine non-major dependency refresh: the OpenTelemetry SDK/instrumentation line moves to its
  current minor, Playwright takes a patch, and the Storybook, Vite, wrangler, noble-curves, and
  better-auth pins stay at their prior versions because the newer releases have not yet cleared the
  seven-day release-age floor. No API or behavior changes in any package.
- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.3.6

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.3.5

### Patch Changes

- a00a9ef: Dependency baseline repair: the marketing site's motion library moves from the retired
  framer-motion package to its motion successor (same API, new import path — the Living Chain
  scroll sequence keeps its exact spring behavior), alongside a routine kysely and vite patch
  refresh across the site and UI packages. The auth, telemetry, storybook, and playwright
  version bumps from the original non-major batch were reverted pending their supply-chain
  release-age window clearing naturally; none of them fixed a known vulnerability.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.3.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.3.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.3.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.3.1

### Patch Changes

- d1b4afa: Renovate non-major dependency bumps; adapt to the OTel sdk-logs BatchLogRecordProcessor
  options-object constructor and the ruff 0.15 StrEnum rule.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.3.0

### Minor Changes

- 0dd715a: The OTel bootstrap now ships logs, not just traces: when an OTLP endpoint is configured,
  `initObservability` boots an OTLP/HTTP logs pipeline alongside the trace exporter and bridges
  `process.stdout`/`process.stderr` writes into it as log records (stdout=INFO, stderr=WARN), so
  every existing log line reaches your logs backend with zero call-site changes. Log bodies pass
  the same bearer-token scrub backstop as span attributes before export, `shutdownObservability`
  flushes the pipeline and restores the raw stream writes, and a new `logExporter` option provides
  the same injectable test seam the trace exporter already had. Dormant behavior is unchanged: no
  endpoint configured means nothing starts.

### Patch Changes

- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

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
