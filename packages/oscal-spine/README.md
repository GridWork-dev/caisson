# @caisson-sh/oscal-spine

The OSCAL export and reference-catalog module for Caisson (Apache-2.0). It owns the deterministic
assessment-plan, assessment-results, POA&M, catalog, XML, and ISO 27001 SoA surfaces together with
the pinned NIST SP 800-53 rev5 catalog and its own-authored OLIR relationship mapping.

`@caisson-sh/compliance-core` and `@caisson-sh/frameworks-pack` both re-export this package so their
existing public OSCAL imports remain source-compatible.

## Entry points

- `.` — the full surface, node-capable (delivery transport, oscal-cli XML validation, vendored
  NIST catalog reads).
- `./browser` — the browser-safe subset: contracts and vocabulary, crosswalk model, catalog pin,
  and the pure catalog + assessment-plan exporters. Its default id seam uses the WebCrypto global
  `crypto.randomUUID()` (Node >= 20.12). Every name on `./browser` is also on `.`.
