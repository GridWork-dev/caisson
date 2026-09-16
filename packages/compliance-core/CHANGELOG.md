# @caisson/compliance-core

## 0.7.2

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0
  - @caisson/risk-register@0.3.5
  - @caisson/field-crypto@1.1.2
  - @caisson/frameworks-pack@0.8.2
  - @caisson/oscal-spine@0.2.2

## 0.7.1

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
  - @caisson/field-crypto@1.1.1
  - @caisson/frameworks-pack@0.8.1
  - @caisson/oscal-spine@0.2.1
  - @caisson/risk-register@0.3.4

## 0.7.0

### Minor Changes

- 2caec56: `@caisson/compliance-core` gains a browser-safe `./browser` entry point: the evidence-collector
  contract with its pass, flagged, and unresolved result constructors, four pure collectors (FORCE
  row-level security, WORM retention, risk register, and the impersonation dual trail), the pack
  format, the cross-framework crosswalk rollup, and the newly exported `assembleEvidenceManifest` can
  now be imported inside a client bundle. The main entry is unchanged and keeps the full surface;
  every browser-entry export is also available there.

  `assembleEvidenceManifest` is the flag-never-guess refusal plus the derived, schema-validated
  canonical manifest body, lifted out of `generateEvidencePack` so there is one implementation for
  both callers — `generateEvidencePack` now composes it and keeps sole ownership of the deterministic
  archive and its digest. Behaviour, the blocked-pack error type, and the output bytes are unchanged.
  The archive phase, the audit-chain-integrity collector, and the PHI-encryption collector each need
  Node and remain on the main entry only.

  The site's compliance interactive demo now runs that real assembly and those real collectors end to
  end instead of a hand-maintained copy.

### Patch Changes

- 74f0756: Both packages gain a browser-safe `./browser` entry point: the contracts and vocabulary, the
  crosswalk model, the catalog pin, the control model with all three framework packs, and the pure
  catalog and assessment-plan exporters can now be imported inside a client bundle. The main entry
  is unchanged and keeps the full node-capable surface; every browser-entry export is also
  available there. As part of this, the catalog and assessment-plan exporters' default id generator
  now uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto
  module — the same UUID format, and any injected `newId` seam behaves exactly as before — and
  both packages now declare a Node 20.12 minimum. Consumers of the compliance-core re-export
  receive the same default-id change.
- Updated dependencies [74f0756]
- Updated dependencies [8875592]
- Updated dependencies [7d74f8f]
  - @caisson/oscal-spine@0.2.0
  - @caisson/frameworks-pack@0.8.0
  - @caisson/field-crypto@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/risk-register@0.3.3

## 0.6.3

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/frameworks-pack@0.7.0
  - @caisson/field-crypto@1.0.1
  - @caisson/oscal-spine@0.1.1
  - @caisson/risk-register@0.3.2

## 0.6.2

### Patch Changes

- a21c478: Adds the standalone $249 OSCAL spine with assessment, results, POA&M, catalog, XML, ISO 27001,
  NIST 800-53, and OLIR support while preserving both parent packages' public exports. The module
  joins Compliance, moving Compliance to $1,649 with a $659 renewal and Everything to $2,259 with
  an $899 renewal.
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
- Updated dependencies [96aa01d]
  - @caisson/field-crypto@1.0.0
  - @caisson/kernel@0.6.0
  - @caisson/oscal-spine@0.1.0
  - @caisson/frameworks-pack@0.6.1
  - @caisson/risk-register@0.3.1

## 0.6.1

### Patch Changes

- Updated dependencies [1c5c137]
  - @caisson/risk-register@0.3.0

## 0.6.0

### Minor Changes

- dd94186: Compliance evidence packs can now be re-run on a schedule instead of only on demand. A new drift
  monitor re-executes your registered evidence collectors, compares the fresh results against the
  last run, and flags exactly which controls changed status. Buyers can accept a known, named gap for
  a limited time (with an expiry and a required reason) so an already-acknowledged issue doesn't
  re-alert on every run — but a genuinely new or different problem on that same control still alerts,
  even while an acceptance is active. Every scheduled run is committed to the existing tamper-evident
  audit trail, so the history of compliance posture over time is itself verifiable, not just the
  latest snapshot.
- ff2cc46: Adds an ISO/IEC 27001:2022 Statement of Applicability generator. A new pure function turns
  the shipped ISO 27001 crosswalk plus a per-control evidence-status map into applicability
  rows (control, applicable, justification, status, evidence pointer); a control with no
  crosswalk row is always marked unresolved rather than guessed. The rows can be rendered
  into an OSCAL component-definition document, validated against the official schema, and
  attached to a generated evidence pack as an additional, clearly separated section that
  never changes the pack's existing signed contents.

### Patch Changes

- fa79938: The EU AI Act risk-register evidence collector now runs on the shared risk-register model instead
  of its own bespoke shape, with no change to what it reports: an empty register is still unresolved,
  and a risk with no treatment plan on record is still flagged. Existing evidence packs are unaffected.
- 0f2215e: The AI risk-register collector's evidence wording now says exactly what it verifies: a
  treatment plan is on record for every risk. The previous "assessed and mitigated" phrasing
  overclaimed — a recorded plan is not proof its measures are in force, and evidence language
  must never say more than the traversal can attest. Golden evidence fixtures re-baselined to the
  corrected wording; verdict logic is unchanged.
- Updated dependencies [ff2cc46]
- Updated dependencies [fa79938]
- Updated dependencies [ff2cc46]
  - @caisson/artifact-render@0.2.0
  - @caisson/risk-register@0.2.0
  - @caisson/frameworks-pack@0.6.0

## 0.5.1

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/field-crypto@0.3.5
  - @caisson/frameworks-pack@0.5.3
  - @caisson/kernel@0.5.3

## 0.5.0

### Minor Changes

- a6fc7a2: The OSCAL export adapter can now push a Security Assessment Results / Plan of Action &
  Milestones bundle to a configured GRC ingest endpoint over live HTTPS, instead of only
  returning the documents for a caller to deliver themselves. The new
  `createOscalHttpTransport` factory and `OscalDeliveryConfigSchema` validate the
  destination URL (public HTTPS only), send an optional Bearer credential, and fail closed
  on a non-2xx response with a single attempt per document — no automatic retries.

## 0.4.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/field-crypto@0.3.4
  - @caisson/frameworks-pack@0.5.2

## 0.4.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/field-crypto@0.3.3
  - @caisson/frameworks-pack@0.5.1

## 0.4.0

### Minor Changes

- d233afe: Adds a generated OSCAL catalog export of caisson's own canonical control catalog — a standards-shaped
  document a GRC platform can ingest, built from the same controls the compliance packs already ship,
  grouped by control family. The cross-framework evidence rollup now also lights up the new NIST
  SP 800-53 crosswalk exactly the way it already lights up the ISO 27001 one, so evidence gathered once
  shows up under every framework a control maps to, NIST included.

### Patch Changes

- Updated dependencies [d233afe]
  - @caisson/frameworks-pack@0.5.0

## 0.3.1

### Patch Changes

- 1de88d7: Test-only: pins that a Rekor `externally-transparent` anchor receipt round-trips the evidence-pack
  detached-attachment path — it canonicalizes cleanly (its byte fields are base64/JSON-safe), the
  generator tags the `externally-transparent` grade and renders the honest public-log auditor phrase, and
  the signed manifest body stays byte-identical. The external-anchor source is already grade-agnostic; no
  runtime change.

## 0.3.0

### Minor Changes

- 1867fa3: Evidence packs can now include external-anchoring proof. When a newest external-anchor receipt
  is available, the evidence-pack generator attaches it as a separate archive entry
  (`external-anchor-receipt.json`) and labels the pack's evidence grade accordingly in
  `auditor-summary.txt`. The signed `manifest.json` body is unchanged either way, so existing
  verification is unaffected, and packs without an anchor receipt are still fully valid — external
  anchoring is an optional upgrade, not a requirement.
- c186409: The cross-framework evidence rollup. `computeCrosswalkRollup` joins the shipped framework packs'
  existing `crosswalk[]` pointers against per-control evidence status into a `CrosswalkRollup` that
  restates, never originates, a claim. The evidence-pack format bumps from v1 to v2 (append-only, so
  old packs are never rewritten): `crosswalkRollup` is now a required manifest section, assembled by
  the generator from a caller-computed value. The OSCAL Security Assessment Results export carries the
  rollup as a Caisson-namespaced report-content property, never a new catalog-model artifact. Adds
  `buildBindingTable`, a derived control-to-collector projection. Re-blesses the evidence-pack and
  OSCAL goldens for the v2 bump.
- c186409: ISO/IEC 27001:2022 ships as a fourth regime crosswalk. `iso27001Crosswalk` provides seven
  own-authored mapping entries over bare Annex A identifiers (never Annex A text), each held at the
  conservative `maps-to` claim level (the legal gate), and each carrying a `canonicalControlId`
  pointer into a real, already-crosswalked framework-pack control. `RegimeId` gains `"iso-27001"`.
  Each identifier pairing was checked, never copied, against the pinned NIST OLIR 2022-edition
  SP 800-53 to ISO/IEC 27001:2022 mapping; the crosswalk's `seedProvenance` pins that mapping's URL
  and an independently verified SHA-256.

  `computeCrosswalkRollup` (`@caisson/compliance-core`) joins the ISO crosswalk's entries through
  their `canonicalControlId` into the same join the framework packs use, so a live collector run
  lights the ISO view exactly like SOC2, HIPAA, and EU-AI-Act. The legal gate is enforced
  structurally: an ISO-driven contribution never carries a verification record, so a cell it
  contributes to can never render `implements`. A new schema-level guard on the rollup cell's `note`
  field extends the existing posture-copy check (no "compliant"/"certified"/"verified" marketing
  language) to the rollup rendering.

### Patch Changes

- e183860: Unify the workspace on zod 4 (catalog flip; the zod4 sub-catalog is retired). Explicit key schemas on every z.record call, and the ZodObject generic signatures drop the v3 "strict" type parameter. Runtime validation behavior is unchanged apart from zod 4's tightened RFC-4122 uuid and email format checks, verified against the money and license seams.
- Updated dependencies [e5e4311]
- Updated dependencies [c186409]
- Updated dependencies [c186409]
- Updated dependencies [e9128e0]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/frameworks-pack@0.4.0
  - @caisson/field-crypto@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [09ed1c8]
  - @caisson/kernel@0.4.3
  - @caisson/frameworks-pack@0.3.0
  - @caisson/field-crypto@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [8c53ca3]
  - @caisson/field-crypto@0.3.0

## 0.2.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [f01b6ed]
- Updated dependencies [0af4dbf]
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/frameworks-pack@0.2.0
