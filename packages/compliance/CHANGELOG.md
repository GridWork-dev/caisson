# @caisson-sh/compliance

## 2.0.1

### Patch Changes

- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [304851a]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2
  - @caisson-sh/audit-worm@2.2.6
  - @caisson-sh/field-crypto@1.1.4
  - @caisson-sh/tenancy-rls@0.6.3
  - @caisson-sh/compliance-core@0.7.4
  - @caisson-sh/frameworks-pack@0.8.4
  - @caisson-sh/migrate@0.2.16
  - @caisson-sh/signing-primitive@0.4.4

## 2.0.0

### Major Changes

- 73bdf3c: The compliance package is now the evidence kit alone. The bundle wrapper and its edition exports are removed, and it no longer re-exports `@caisson-sh/alerting` or `@caisson-sh/retention-runner`; import those packages directly.

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [8226c84]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/audit-worm@2.2.5
  - @caisson-sh/compliance-core@0.7.3
  - @caisson-sh/frameworks-pack@0.8.3
  - @caisson-sh/migrate@0.2.15
  - @caisson-sh/signing-primitive@0.4.3
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/field-crypto@1.1.3
  - @caisson-sh/kernel@0.10.1

## 1.0.4

### Patch Changes

- Updated dependencies [045b21e]
- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/audit-worm@2.2.4
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/alerting@0.3.2
  - @caisson/field-crypto@1.1.2
  - @caisson/compliance-core@0.7.2
  - @caisson/frameworks-pack@0.8.2
  - @caisson/migrate@0.2.14
  - @caisson/retention-runner@0.2.2
  - @caisson/signing-primitive@0.4.2

## 1.0.3

### Patch Changes

- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/field-crypto@1.1.1
  - @caisson/signing-primitive@0.4.1
  - @caisson/tenancy-rls@0.6.0
  - @caisson/alerting@0.3.1
  - @caisson/audit-worm@2.2.3
  - @caisson/compliance-core@0.7.1
  - @caisson/frameworks-pack@0.8.1
  - @caisson/migrate@0.2.13
  - @caisson/retention-runner@0.2.1

## 1.0.2

### Patch Changes

- Updated dependencies [74f0756]
- Updated dependencies [98bf1f3]
- Updated dependencies [49f26a4]
- Updated dependencies [8875592]
- Updated dependencies [2caec56]
- Updated dependencies [7d74f8f]
  - @caisson/frameworks-pack@0.8.0
  - @caisson/compliance-core@0.7.0
  - @caisson/signing-primitive@0.4.0
  - @caisson/alerting@0.3.0
  - @caisson/retention-runner@0.2.0
  - @caisson/field-crypto@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/audit-worm@2.2.2
  - @caisson/migrate@0.2.12
  - @caisson/tenancy-rls@0.5.8

## 1.0.1

### Patch Changes

- e917c52: The migration test suite now proves that every migration file shipped with the compliance modules is listed in the fixed release order, and that the fixed order names no file that has been removed. An unlisted migration would have been free to change position when a later module added one of its own, which reads as tampering to any database that already applied it.
- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/frameworks-pack@0.7.0
  - @caisson/alerting@0.2.6
  - @caisson/audit-worm@2.2.1
  - @caisson/compliance-core@0.6.3
  - @caisson/field-crypto@1.0.1
  - @caisson/migrate@0.2.11
  - @caisson/signing-primitive@0.3.9
  - @caisson/retention-runner@0.1.14
  - @caisson/tenancy-rls@0.5.7

## 1.0.0

### Major Changes

- 31bf5f1: Require and mirror the KMS deletion-state receipt in erasure crypto-shred operational telemetry.

### Patch Changes

- a21c478: Adds the standalone $249 OSCAL spine with assessment, results, POA&M, catalog, XML, ISO 27001,
  NIST 800-53, and OLIR support while preserving both parent packages' public exports. The module
  joins Compliance, moving Compliance to $1,649 with a $659 renewal and Everything to $2,259 with
  an $899 renewal.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
- Updated dependencies [96aa01d]
  - @caisson/audit-worm@2.2.0
  - @caisson/field-crypto@1.0.0
  - @caisson/kernel@0.6.0
  - @caisson/compliance-core@0.6.2
  - @caisson/frameworks-pack@0.6.1
  - @caisson/alerting@0.2.5
  - @caisson/retention-runner@0.1.13
  - @caisson/migrate@0.2.10
  - @caisson/signing-primitive@0.3.8
  - @caisson/tenancy-rls@0.5.6

## 0.6.0

### Minor Changes

- 1c5c137: The Compliance bundle gains three new members — access reviews, the risk register, and
  the buyer trust page — and is repriced to $1,449, holding the same below-sum ratio over
  the enlarged member set.

### Patch Changes

- Updated dependencies [3b9237b]
  - @caisson/signing-primitive@0.3.7
  - @caisson/compliance-core@0.6.1

## 0.5.10

### Patch Changes

- Updated dependencies [dd94186]
- Updated dependencies [fa79938]
- Updated dependencies [ff2cc46]
- Updated dependencies [0f2215e]
- Updated dependencies [31d59fd]
  - @caisson/compliance-core@0.6.0
  - @caisson/frameworks-pack@0.6.0
  - @caisson/signing-primitive@0.3.6

## 0.5.9

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/audit-worm@2.1.4
  - @caisson/alerting@0.2.4
  - @caisson/compliance-core@0.5.1
  - @caisson/field-crypto@0.3.5
  - @caisson/frameworks-pack@0.5.3
  - @caisson/kernel@0.5.3
  - @caisson/migrate@0.2.9
  - @caisson/retention-runner@0.1.12
  - @caisson/signing-primitive@0.3.5
  - @caisson/tenancy-rls@0.5.5

## 0.5.8

### Patch Changes

- Updated dependencies [a6fc7a2]
- Updated dependencies [302b521]
  - @caisson/compliance-core@0.5.0
  - @caisson/signing-primitive@0.3.4

## 0.5.7

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/alerting@0.2.3
  - @caisson/audit-worm@2.1.3
  - @caisson/compliance-core@0.4.2
  - @caisson/field-crypto@0.3.4
  - @caisson/frameworks-pack@0.5.2
  - @caisson/migrate@0.2.8
  - @caisson/retention-runner@0.1.11
  - @caisson/signing-primitive@0.3.3
  - @caisson/tenancy-rls@0.5.4

## 0.5.6

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/alerting@0.2.2
  - @caisson/audit-worm@2.1.2
  - @caisson/compliance-core@0.4.1
  - @caisson/field-crypto@0.3.3
  - @caisson/frameworks-pack@0.5.1
  - @caisson/migrate@0.2.7
  - @caisson/retention-runner@0.1.10
  - @caisson/signing-primitive@0.3.2
  - @caisson/tenancy-rls@0.5.3

## 0.5.5

### Patch Changes

- Updated dependencies [d233afe]
- Updated dependencies [d233afe]
- Updated dependencies [4c6d3f7]
  - @caisson/compliance-core@0.4.0
  - @caisson/frameworks-pack@0.5.0
  - @caisson/signing-primitive@0.3.1
  - @caisson/audit-worm@2.1.1
  - @caisson/retention-runner@0.1.9

## 0.5.4

### Patch Changes

- 3fdc6a8: Each bundle's member list now references the current published release of every included module, replacing references to superseded releases that are no longer downloadable. Installing any of these bundles resolves every included module to a real, currently available package.

## 0.5.3

### Patch Changes

- Updated dependencies [1de88d7]
- Updated dependencies [1de88d7]
- Updated dependencies [1de88d7]
  - @caisson/compliance-core@0.3.1
  - @caisson/audit-worm@2.1.0
  - @caisson/signing-primitive@0.3.0

## 0.5.2

### Patch Changes

- c186409: Wire the mirrored evidence-pack goldens to the compliance-core v2 format bump (the new
  `crosswalkRollup` section): re-blesses each package's static copy of the evidence-pack manifest
  golden and, for `@caisson/signing-primitive`, regenerates the golden detached Ed25519 signature over
  the new canonical bytes (same fixed test key; public key unchanged). No behavior change, fixture
  parity only.
- Updated dependencies [ca44db5]
- Updated dependencies [1867fa3]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [c186409]
- Updated dependencies [c186409]
- Updated dependencies [c186409]
- Updated dependencies [c186409]
- Updated dependencies [e9128e0]
- Updated dependencies [e183860]
  - @caisson/audit-worm@2.0.0
  - @caisson/compliance-core@0.3.0
  - @caisson/kernel@0.5.0
  - @caisson/signing-primitive@0.2.2
  - @caisson/frameworks-pack@0.4.0
  - @caisson/alerting@0.2.1
  - @caisson/field-crypto@0.3.2
  - @caisson/migrate@0.2.6
  - @caisson/retention-runner@0.1.8
  - @caisson/tenancy-rls@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [1bc677a]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [09ed1c8]
  - @caisson/audit-worm@1.0.0
  - @caisson/alerting@0.2.0
  - @caisson/kernel@0.4.3
  - @caisson/migrate@0.2.5
  - @caisson/tenancy-rls@0.5.1
  - @caisson/frameworks-pack@0.3.0
  - @caisson/retention-runner@0.1.7
  - @caisson/compliance-core@0.2.2
  - @caisson/field-crypto@0.3.1
  - @caisson/signing-primitive@0.2.1

## 0.5.0

### Minor Changes

- The Compliance package's registry manifest is now a first-class bundle entry at the locked
  six-bundle catalog price of $1,049, replacing the legacy edition declaration and the earlier
  $799 price. Nothing changes for existing licenses: historical edition entries stay valid
  forever, the compliance id keeps resolving exactly as before, and the composed member set is
  unchanged.

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies [8c53ca3]
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/audit-worm@0.3.0
  - @caisson/field-crypto@0.3.0
  - @caisson/tenancy-rls@0.5.0
  - @caisson/compliance-core@0.2.1
  - @caisson/signing-primitive@0.2.0
  - @caisson/retention-runner@0.1.6

## 0.4.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- aec9f1c: The Compliance edition's registry manifest carried a stale placeholder price. Its listed price
  now matches the committed $799 shown at checkout, so buyers browsing the module registry and
  buyers checking out see the same number.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and corrected a couple of stale cross-package dependency and usage claims to
  match the shipped code. No runtime behavior changed in any package — documentation and
  comments only.
- Updated dependencies [b791198]
- Updated dependencies [aec9f1c]
- Updated dependencies [f01b6ed]
- Updated dependencies [0c883ae]
- Updated dependencies [aec9f1c]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/alerting@0.1.5
  - @caisson/audit-worm@0.2.4
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/migrate@0.2.4
  - @caisson/retention-runner@0.1.5
  - @caisson/tenancy-rls@0.4.0
  - @caisson/compliance-core@0.2.0
  - @caisson/frameworks-pack@0.2.0
  - @caisson/signing-primitive@0.2.0

## 0.3.1

### Patch Changes

- cf66d65: Add a typed regulatory-exemption posture worksheet to the Compliance edition:
  `defineExemptionWorksheet` maps a legal exemption's own test elements (e.g. an FTC
  endorsement-disclosure requirement) to concrete, checkable rules an AI copy generator's
  output must satisfy, each tagged with how it's enforced today (automated guardrail, human
  review, or untracked) and an optional human sign-off once a reviewer has actually looked
  at it. Every worksheet carries a fixed "not legal advice" disclaimer enforced by the
  schema itself, not left to authoring discipline. Ships as a documentation convention and a
  validated data shape — it defines no new enforcement gate on its own. A generic,
  unsigned FTC endorsement-guide exemplar is included to show the shape filled in.
- cf66d65: Hardened row-level security on the support-impersonation session table: the tenant-isolation
  check now discards an empty-string tenant identifier before comparing it against a row's
  tenant column, instead of comparing against it directly. This closes a narrow gap where
  certain connection-pooling configurations can leave a database session with an empty string
  instead of a properly cleared value, which previously could coincide with a real row's tenant
  column and let it be read. Shipped as a follow-up migration alongside the original table
  migration, so existing installs pick up the hardening on their next migrate run.
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/alerting@0.1.4
  - @caisson/audit-worm@0.2.3
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/retention-runner@0.1.4
  - @caisson/tenancy-rls@0.3.2
  - @caisson/migrate@0.2.3

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

- a07feb0: Fold the operational-compliance primitives into the edition member pin maps: Compliance now
  bundles `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`,
  so buyers get them at the edition price (matches the below-module-sum edition reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Security hardening pass: LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered; AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred; BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected for accuracy.
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
