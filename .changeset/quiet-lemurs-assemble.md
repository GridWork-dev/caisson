---
"@caisson/compliance-core": minor
"@caisson/site": patch
---

`@caisson/compliance-core` gains a browser-safe `./browser` entry point: the evidence-collector
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
