# @caisson/compliance-core

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
