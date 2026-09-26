# @caisson-sh/oscal-spine — agent contract

This package owns Caisson's complete OSCAL export surface and the pinned NIST SP 800-53
reference axis.

## Invariants

- OSCAL output is deterministic when `now` and `newId` are injected.
- Export language stays readiness-only; never claim certification, compliance, or FedRAMP status.
- Vendored NIST bytes and pins move together through the explicit vendor procedure.
- OLIR rows remain own-authored mappings with NIST IR 8278A relationship vocabulary.
- No dependency on either parent package: `@caisson-sh/compliance-core` and
  `@caisson-sh/frameworks-pack` depend on and re-export this package.
- Two entry points: `.` is the full node-capable surface; `./browser` is the browser-safe subset
  (contracts, crosswalk model, catalog pin, pure catalog + assessment-plan exporters — id seam
  defaults to the WebCrypto global, Node >= 20.12). A client bundle imports `./browser`, never
  `.`; a module joins `./browser` only if its whole graph passes the package's static
  source-graph walk (`src/browser-safety.test.ts`), and every `./browser` name must also exist
  on `.`.
