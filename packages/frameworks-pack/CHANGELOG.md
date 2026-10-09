# @caisson-sh/frameworks-pack

## 0.8.3

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/oscal-spine@0.2.3
  - @caisson-sh/kernel@0.10.1

## 0.8.2

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0
  - @caisson/oscal-spine@0.2.2

## 0.8.1

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
  - @caisson/oscal-spine@0.2.1

## 0.8.0

### Minor Changes

- 74f0756: Both packages gain a browser-safe `./browser` entry point: the contracts and vocabulary, the
  crosswalk model, the catalog pin, the control model with all three framework packs, and the pure
  catalog and assessment-plan exporters can now be imported inside a client bundle. The main entry
  is unchanged and keeps the full node-capable surface; every browser-entry export is also
  available there. As part of this, the catalog and assessment-plan exporters' default id generator
  now uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto
  module — the same UUID format, and any injected `newId` seam behaves exactly as before — and
  both packages now declare a Node 20.12 minimum. Consumers of the compliance-core re-export
  receive the same default-id change.

### Patch Changes

- Updated dependencies [74f0756]
- Updated dependencies [7d74f8f]
  - @caisson/oscal-spine@0.2.0
  - @caisson/kernel@0.8.0

## 0.7.0

### Minor Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/oscal-spine@0.1.1

## 0.6.1

### Patch Changes

- a21c478: Adds the standalone $249 OSCAL spine with assessment, results, POA&M, catalog, XML, ISO 27001,
  NIST 800-53, and OLIR support while preserving both parent packages' public exports. The module
  joins Compliance, moving Compliance to $1,649 with a $659 renewal and Everything to $2,259 with
  an $899 renewal.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
  - @caisson/kernel@0.6.0
  - @caisson/oscal-spine@0.1.0

## 0.6.0

### Minor Changes

- ff2cc46: Adds an ISO/IEC 27001:2022 Statement of Applicability generator. A new pure function turns
  the shipped ISO 27001 crosswalk plus a per-control evidence-status map into applicability
  rows (control, applicable, justification, status, evidence pointer); a control with no
  crosswalk row is always marked unresolved rather than guessed. The rows can be rendered
  into an OSCAL component-definition document, validated against the official schema, and
  attached to a generated evidence pack as an additional, clearly separated section that
  never changes the pack's existing signed contents.

## 0.5.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.5.0

### Minor Changes

- d233afe: Adds a fifth compliance crosswalk: NIST SP 800-53 Revision 5.2.0. The full text of the Revision 5
  catalog now ships in this package too, vendored verbatim and hash-pinned to a specific upstream
  commit, so it's available as an in-repo reference rather than an external claim. A new set of
  mapping rows shows which caisson mechanisms genuinely relate to specific 800-53 controls — access
  enforcement, audit logging and retention, encryption, monitoring, authentication, and media
  sanitization — each capped at the same conservative "maps to" language every other crosswalk in
  this package already uses, never an "implements" or "satisfies" claim. This crosswalk carries no
  FedRAMP claim of any kind: Caisson holds no ATO and is not FedRAMP authorized, and nothing here
  implies otherwise.

## 0.4.0

### Minor Changes

- c186409: Structured verification provenance for crosswalk mappings. `CrosswalkReference` gains an optional
  `verification` object (review status, relationship, source id/version/digest, and reviewer)
  replacing the never-shipped `verified: boolean`, alongside an `isVerificationStale` helper.
  `RegimeCrosswalkRow` gains an optional `canonicalControlId` join surface (unused until a later
  increment wires ISO into the evidence rollup), and `RegimeCrosswalk` gains an optional
  crosswalk-level `seedProvenance` pin for the public-domain mapping data a crosswalk was checked
  against. Adds the first reviewed verification record: the `DATA-PROTECTION.DISPOSAL` control's
  SOC2-TSC `C1.2` reference (crypto-shred), re-blessing only the `soc2-tsc` catalog golden.
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

- e9128e0: Correct the control-registry header comment: the third-party-catalog ingestion ban is scoped to
  NoDerivatives-licensed catalogs; public-domain reference material may seed crosswalk mapping rows
  as pointers with provenance. Comment-only change, no runtime behavior difference.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.3.0

### Minor Changes

- 09ed1c8: Add SOC 2, PCI DSS, and GDPR named-regime crosswalks to the compliance framework pack. Each
  crosswalk maps the regime's control ids to the specific Caisson module and mechanism that addresses
  them, with a machine-readable claim level per row: "implements" only where a live test in the
  repository proves the technical control (and that proof is linked on the row), "maps to" everywhere
  else. Every row also states what remains the buyer's responsibility. Each crosswalk exports as a
  self-contained artifact with the regime revision pinned and a scope disclaimer embedded, so a
  reviewer reading it outside the website sees exactly what is and is not covered — the crosswalks are
  mappings, not a certification or a claim of compliance.

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.2.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
