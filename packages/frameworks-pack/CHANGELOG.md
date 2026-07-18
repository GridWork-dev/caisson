# @caisson/frameworks-pack

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
