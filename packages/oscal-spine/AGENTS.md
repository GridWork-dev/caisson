# @caisson/oscal-spine — agent contract

This commercial package owns Caisson's complete OSCAL export surface and the pinned NIST SP 800-53
reference axis.

## Invariants

- OSCAL output is deterministic when `now` and `newId` are injected.
- Export language stays readiness-only; never claim certification, compliance, or FedRAMP status.
- Vendored NIST bytes and pins move together through the explicit vendor procedure.
- OLIR rows remain own-authored mappings with NIST IR 8278A relationship vocabulary.
- No dependency on either parent package: `@caisson/compliance-core` and
  `@caisson/frameworks-pack` depend on and re-export this package.
