// The browser-safe entry (`@caisson-sh/oscal-spine/browser`, ADR-0396): the OSCAL vocabulary,
// crosswalk model, catalog pin, and the two pure exporters (catalog + assessment-plan), whose id
// seam defaults to the WebCrypto global `crypto.randomUUID()` (engines >= 20.12). ADDITIVE — the
// `.` barrel is untouched and stays the full node-capable surface; every name here is also on `.`
// (the subset test in browser-safety.test.ts pins that direction).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - evidence/oscal-export.ts + oscal-export-xml.ts — the live HTTPS delivery transport and the
//     oscal-cli spawn (node:child_process, node:fs, node:os, node:path, node:util). Irreducibly
//     node-only; their TYPES are re-exported below (erased at emit, no bundle-graph edge).
//   - vendor/nist-catalog-controls.ts — node:fs reads the vendored NIST catalog.
//   - evidence/oscal-iso27001-soa.ts — randomUUID-only and COULD join, but it value-imports
//     @caisson-sh/artifact-render; admission to this entry requires that package's graph to ride the
//     same source-graph walk first (ADR-0396's admission rule).
// ponytail: iso27001-soa stays off until a consumer needs it browser-side — the shared walker can
// prove artifact-render clean the day one does.
export * from "./contracts.ts";
export * from "./crosswalks/regime-crosswalk.ts";
export * from "./crosswalks/nist-800-53.ts";
export * from "./vendor/nist-catalog-pin.ts";
export * from "./evidence/oscal-catalog-export.ts";
export * from "./evidence/oscal-assessment-plan.ts";
export type {
  OscalExportOptions,
  OscalMetadata,
  OscalProp,
} from "./evidence/oscal-export.ts";
